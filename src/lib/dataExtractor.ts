interface ExtractedData {
  batchId?: string
  strainName?: string
  category?: string
  subCategory?: string
  thcPercentage?: number
  cbdPercentage?: number
  totalCannabinoids?: number
  labName?: string
  testDate?: string
  terpenes?: Array<{ name: string; percentage: number }>
  confidence: number
  extractionMethod?: string
}

interface MistralExtractionResponse {
  choices: Array<{ message: { content: string } }>
}

interface ExtractionStrategy {
  name: string
  extract: (text: string) => ExtractedData
}

export async function extractDataFromOCRText(ocrText: string): Promise<ExtractedData> {
  try {
    console.log('Starting COA data extraction')
    console.log('Text length:', ocrText.length)

    const labType = detectLabType(ocrText)
    console.log('Detected lab type:', labType)

    const strategies = getExtractionStrategies(labType)
    console.log('Using strategies:', strategies.map(s => s.name))

    const results: ExtractedData[] = []
    for (const strategy of strategies) {
      console.log(`\nExecuting strategy: ${strategy.name}`)
      const result = strategy.extract(ocrText)
      results.push(result)
      console.log(`${strategy.name} results:`, {
        thc: result.thcPercentage,
        cbd: result.cbdPercentage,
        total: result.totalCannabinoids,
        testDate: result.testDate,
        terps: result.terpenes?.length || 0,
        confidence: result.confidence
      })
      if (result.confidence >= 85 && hasCompleteDataLite(result)) {
        console.log('High confidence result found, stopping early')
        break
      }
    }

    const finalResult = combineResults(results, labType)

    // Try terpene extraction ONLY if a terpene panel exists (prevents false 0s)
    const terpPanel = findTerpenePanel(ocrText)
    if (terpPanel) {
      const terps = extractTerpenesFromPanel(terpPanel)
      if (terps.length) {
        finalResult.terpenes = terps.slice(0, 3)
        finalResult.confidence = Math.min((finalResult.confidence || 0) + 8, 95)
      }
    } else {
      console.log('No explicit terpene panel detected; skipping terpene parsing.')
    }

    // Try test date (2River styles) if missing
    if (!finalResult.testDate) {
      const iso = extractTestDateISO(ocrText)
      if (iso) {
        finalResult.testDate = iso
        finalResult.confidence = Math.min((finalResult.confidence || 0) + 5, 95)
      }
    }

    console.log('\nFinal result:', {
      batchId: finalResult.batchId,
      strain: finalResult.strainName,
      thc: finalResult.thcPercentage,
      cbd: finalResult.cbdPercentage,
      total: finalResult.totalCannabinoids,
      testDate: finalResult.testDate,
      terpenes: finalResult.terpenes?.length || 0,
      confidence: finalResult.confidence,
      method: finalResult.extractionMethod
    })

    return finalResult

  } catch (error) {
    console.error('Extraction failed:', error)
    return { confidence: 10, labName: detectLabName(ocrText) || "UNKNOWN LAB" }
  }
}

// ----------------- Lab detection -----------------
function detectLabType(text: string): string {
  if (/2\s*RIVER\s*LABS/i.test(text)) return '2river'
  if (/SC\s*LABS/i.test(text)) return 'sclabs'
  if (/STEEP\s*HILL/i.test(text)) return 'steephill'
  return 'generic'
}
function detectLabName(text: string): string | null {
  const labs = [/2\s*RIVER\s*LABS[^,\n]*/i, /SC\s*LABS[^,\n]*/i, /STEEP\s*HILL[^,\n]*/i]
  for (const p of labs) { const m = text.match(p); if (m) return m[0].trim() }
  return null
}

// ----------------- Strategy factory -----------------
function getExtractionStrategies(labType: string): ExtractionStrategy[] {
  const base: ExtractionStrategy[] = [
    { name: 'structured_pattern', extract: structuredPatternExtraction },
    { name: 'numerical_analysis', extract: numericalAnalysisExtraction },
    { name: 'contextual_search', extract: contextualSearchExtraction }
  ]
  if (labType === '2river') base.unshift({ name: '2river_specific', extract: river2SpecificExtraction })
  return base
}

// ----------------- Strategies -----------------
function river2SpecificExtraction(text: string): ExtractedData {
  const res: ExtractedData = {
    confidence: 40, labName: "2 RIVER LABS, INC", category: "INHALABLE", extractionMethod: "2river_specific"
  }
  const clean = text.replace(/\s+/g, ' ').trim()

  const batch = clean.match(/(?:BATCH\s*ID\s*:?\s*)?(EVM\d{4,})/i)
  if (batch) { res.batchId = batch[1]; res.confidence += 15 }

  const sample = clean.match(/SAMPLE\s*:\s*([A-Z][A-Z\s&-]+?)\s*\(?FLOWER/i)
  if (sample) { res.strainName = sample[1].trim(); res.confidence += 10 }

  if (/FLOWER|MATRIX:\s*FLOWER/i.test(text)) { res.subCategory = 'FLOWER'; res.confidence += 5 }

  res.thcPercentage = extractCannabinoidValue(clean, 'THC')
  res.cbdPercentage = extractCannabinoidValue(clean, 'CBD')
  res.totalCannabinoids = extractCannabinoidValue(clean, 'TOTAL CANNABINOIDS')

  if (res.thcPercentage != null) res.confidence += 25
  if (res.cbdPercentage != null) res.confidence += 20
  if (res.totalCannabinoids != null) res.confidence += 20

  // test date (from produced/tested lines)
  const iso = extractTestDateISO(text)
  if (iso) { res.testDate = iso; res.confidence += 5 }

  // Don't parse terpenes here; done centrally with panel detection
  return res
}

function structuredPatternExtraction(text: string): ExtractedData {
  const res: ExtractedData = { confidence: 30, extractionMethod: "structured_pattern" }
  const sections = text.split(/\n(?=[A-Z-]+:|M-\d+:|##|=== PAGE)/g)
  for (const sec of sections) {
    if (/POTENCY|CANNABINOID/i.test(sec)) {
      const c = parseStructuredCannabinoids(sec)
      if (c.thc != null) res.thcPercentage = c.thc
      if (c.cbd != null) res.cbdPercentage = c.cbd
      if (c.total != null) res.totalCannabinoids = c.total
      if (c.thc != null || c.cbd != null || c.total != null) res.confidence += 30
    }
    if (!res.testDate) {
      const iso = extractTestDateISO(sec)
      if (iso) { res.testDate = iso; res.confidence += 5 }
    }
  }
  return res
}

function numericalAnalysisExtraction(text: string): ExtractedData {
  const res: ExtractedData = { confidence: 25, extractionMethod: "numerical_analysis" }
  const nums = text.match(/\d+\.\d+/g) || []
  for (const d of nums) {
    const v = parseFloat(d)
    if (v >= 15 && v <= 35 && res.thcPercentage == null) { res.thcPercentage = v; res.confidence += 20 }
    if (v >= 0.01 && v <= 5 && res.cbdPercentage == null) { res.cbdPercentage = v; res.confidence += 15 }
    if (v >= 15 && v <= 40 && res.totalCannabinoids == null) {
      if (!res.thcPercentage || Math.abs(v - res.thcPercentage) <= 5) { res.totalCannabinoids = v; res.confidence += 15 }
    }
  }
  const iso = extractTestDateISO(text)
  if (iso) { res.testDate = iso; res.confidence += 5 }
  return res
}

function contextualSearchExtraction(text: string): ExtractedData {
  const res: ExtractedData = { confidence: 20, extractionMethod: "contextual_search" }
  const windows = [{ k: 'THC', f: 'thcPercentage' }, { k: 'CBD', f: 'cbdPercentage' }, { k: 'CANNABINOID', f: 'totalCannabinoids' }]
  for (const w of windows) {
    const v = findValueInContext(text, w.k)
    if (v != null) { (res as any)[w.f] = v; res.confidence += 15 }
  }
  const iso = extractTestDateISO(text)
  if (iso) { res.testDate = iso; res.confidence += 5 }
  return res
}

// ----------------- Date helpers -----------------
function extractTestDateISO(text: string): string | undefined {
  const monthMap: Record<string,string> =
    { JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06', JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12' }

  const pats = [
    /(?:PRODUCED|TEST\s*DATE|TESTED)\s*:?\s*([A-Z]{3})\s+(\d{1,2})[,.\s]+(\d{4})/i,
    /M-\d+[A-Z]?:[^/]*\/\/\s*([A-Z]{3})\s+(\d{1,2})[,.\s]+(\d{4})/i,
    /([A-Z]{3})\s+(\d{1,2})[,.\s]+(\d{4})/i
  ]

  for (const r of pats) {
    const m = text.match(r)
    if (m) {
      const mon = monthMap[m[1].toUpperCase()]
      if (!mon) continue
      const day = m[2].padStart(2, '0')
      const year = m[3]
      return `${year}-${mon}-${day}T00:00:00.000Z`
    }
  }
  return undefined
}

// ----------------- Terpene panel parsing -----------------

// Find the terpene panel slice to parse (M-0255: TERPENES BY GC-FID)
function findTerpenePanel(text: string): string | null {
  // Try to capture from the terpene header up to the next "M-" section or next page
  const m = text.match(/(M-0?255[^]*?)(?=(?:\nM-\d{3}|\n=== PAGE|\n#\s+REGULATORY|$))/i)
  if (m) {
    console.log('✅ Terpene panel detected (M-0255). Section length:', m[1].length)
    return m[1]
  }
  const alt = text.match(/(TERPENES?\s+BY\s+GC-?FID[^]*?)(?=(?:\nM-\d{3}|\n=== PAGE|\n#\s+REGULATORY|$))/i)
  if (alt) {
    console.log('✅ Terpene panel detected (TERPENES BY GC-FID). Section length:', alt[1].length)
    return alt[1]
  }
  const prof = text.match(/(TERPENE\s+PROFILE[^]*?)(?=(?:\nM-\d{3}|\n=== PAGE|\n#\s+REGULATORY|$))/i)
  if (prof) {
    console.log('✅ Terpene panel detected (TERPENE PROFILE). Section length:', prof[1].length)
    return prof[1]
  }
  return null
}

// Normalize names like "β-MYRCENE" → "Myrcene"
function normalizeTerpName(raw: string): string {
  const n = raw
    .replace(/β|&beta;|BETA/gi, 'Beta-')
    .replace(/α|&alpha;|ALPHA/gi, 'Alpha-')
    .replace(/γ|&gamma;|GAMMA/gi, 'Gamma-')
    .replace(/TRANS-|CIS-/gi, '')
    .replace(/-OXIDE/gi, ' Oxide')
    .replace(/[^A-Za-z -]/g, '')
    .trim()
    .toLowerCase()
  // map common forms
  const map: Record<string,string> = {
    'limonene': 'Limonene',
    'beta-myrcene': 'Myrcene', 'myrcene': 'Myrcene',
    'beta-caryophyllene': 'Caryophyllene', 'caryophyllene': 'Caryophyllene',
    'linalool': 'Linalool',
    'alpha-humulene': 'Humulene', 'humulene': 'Humulene',
    'beta-pinene': 'Beta-Pinene', 'pinene': 'Pinene', 'alpha-pinene': 'Alpha-Pinene',
    'bisabolol': 'Bisabolol',
    'terpinolene': 'Terpinolene',
    'ocimene': 'Ocimene', 'cis-ocimene': 'Ocimene',
    'eucalyptol': 'Eucalyptol',
    'geraniol': 'Geraniol',
    'guaiol': 'Guaiol',
    'p-cymene': 'p-Cymene', 'cymene': 'Cymene',
    'camphene': 'Camphene',
    'caryophyllene oxide': 'Caryophyllene Oxide'
  }
  return map[n] || n.replace(/\b\w/g, c => c.toUpperCase())
}

// Parse AMT column values; handle %, mg/g, ND, < LOQ
function parseAmtToPercent(amt: string): number | null {
  if (!amt) return null
  const s = amt.trim().toUpperCase()
  if (s.includes('ND') || s.includes('< LOQ') || s.includes('<LOQ')) return null
  // Percent like "0.514 %" or "0.514%"
  const pm = s.match(/(-?\d+(?:\.\d+)?)\s*%/)
  if (pm) return parseFloat(pm[1])

  // mg/g like "5.14 mg/g" -> approx % (1 mg/g ≈ 0.1%)
  const mg = s.match(/(-?\d+(?:\.\d+)?)\s*MG\/G/)
  if (mg) return parseFloat(mg[1]) * 0.1

  // Sometimes just a bare number in the AMT column that is % by context
  const bare = s.match(/(-?\d+(?:\.\d+)?)(?![^])/)
  if (bare) return parseFloat(bare[1])

  return null
}

// Core terpene parser using the panel slice
function extractTerpenesFromPanel(panel: string): Array<{ name: string; percentage: number }> {
  const results: Record<string, number> = {}
  const lines = panel.split(/\n| \| /g).map(l => l.trim()).filter(Boolean)

  // Try to pair analyte + amt on each row-like sequence
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip headers
    if (/ANALYTE|AMT|LOD\/LOQ|PASS\/FAIL/i.test(line)) continue
    if (/TOTAL\s+TERPENES/i.test(line)) continue

    // Look for a terpene-like analyte name
    const nameMatch = line.match(/\b([A-Zα-ωβγ\- ]{3,})\b/i)
    if (!nameMatch) continue

    // Collect a small window to find the numeric value
    const window = [line, lines[i+1] || '', lines[i+2] || ''].join('  ')
    const percent = parseAmtToPercent(window)
    if (percent == null || percent <= 0) continue

    const pretty = normalizeTerpName(nameMatch[1])
    // store max if duplicated
    results[pretty] = Math.max(results[pretty] || 0, percent)
  }

  const arr = Object.entries(results)
    .map(([name, percentage]) => ({ name, percentage }))
    .filter(t => t.percentage > 0 && t.percentage < 20) // sanity bounds
    .sort((a, b) => b.percentage - a.percentage)

  console.log('Parsed terpene candidates:', arr.slice(0, 6))
  return arr.slice(0, 5) // keep up to 5; caller will slice to 3
}

// ----------------- Cannabinoid helpers -----------------
function extractCannabinoidValue(text: string, cannabinoidType: string): number | undefined {
  const patterns = [
    new RegExp(`TOTAL\\s+${cannabinoidType}\\s*:?\\s*(\\d+\\.?\\d*)\\s*%`, 'i'),
    new RegExp(`${cannabinoidType}\\s+TOTAL\\s*:?\\s*(\\d+\\.?\\d*)\\s*%`, 'i'),
    new RegExp(`${cannabinoidType}\\s*:?\\s*(\\d+\\.?\\d*)\\s*%`, 'i')
  ]
  for (const r of patterns) {
    const m = text.match(r)
    if (m) {
      const v = parseFloat(m[1])
      if (isValidCannabinoidValue(v, cannabinoidType)) return v
    }
  }
  return undefined
}

function isValidCannabinoidValue(value: number, type: string): boolean {
  if (!isFinite(value) || value < 0) return false
  switch (type.toUpperCase()) {
    case 'THC': return value <= 50
    case 'CBD': return value <= 30
    case 'TOTAL CANNABINOIDS': return value <= 60
    default: return value <= 100
  }
}

function parseStructuredCannabinoids(section: string): { thc?: number, cbd?: number, total?: number } {
  const out: any = {}
  const lines = section.split('\n')
  for (const l of lines) {
    if (/THC/i.test(l)) { const m = l.match(/(\d+\.?\d*)\s*%/); if (m) out.thc = parseFloat(m[1]) }
    if (/CBD/i.test(l)) { const m = l.match(/(\d+\.?\d*)\s*%/); if (m) out.cbd = parseFloat(m[1]) }
    if (/TOTAL.*CANNABINOID/i.test(l)) { const m = l.match(/(\d+\.?\d*)\s*%/); if (m) out.total = parseFloat(m[1]) }
  }
  return out
}

function findValueInContext(text: string, keyword: string, windowSize = 100): number | undefined {
  const re = new RegExp(keyword, 'gi')
  let m
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - windowSize)
    const end = Math.min(text.length, m.index + keyword.length + windowSize)
    const ctx = text.substring(start, end)
    const vm = ctx.match(/(\d+\.?\d*)\s*%/)
    if (vm) {
      const v = parseFloat(vm[1])
      if (isValidCannabinoidValue(v, keyword)) return v
    }
  }
  return undefined
}

// ----------------- Merge & scoring -----------------
function hasCompleteDataLite(r: ExtractedData): boolean {
  return !!(r.thcPercentage != null && r.totalCannabinoids != null)
}

function combineResults(results: ExtractedData[], labType: string): ExtractedData {
  if (!results.length) return { confidence: 10, labName: "UNKNOWN LAB" }
  const sorted = results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  const base: ExtractedData = { ...sorted[0] }

  for (const r of sorted.slice(1)) {
    if (!base.batchId && r.batchId) base.batchId = r.batchId
    if (!base.strainName && r.strainName) base.strainName = r.strainName
    if (base.thcPercentage == null && r.thcPercentage != null) base.thcPercentage = r.thcPercentage
    if (base.cbdPercentage == null && r.cbdPercentage != null) base.cbdPercentage = r.cbdPercentage
    if (base.totalCannabinoids == null && r.totalCannabinoids != null) base.totalCannabinoids = r.totalCannabinoids
    if (!base.testDate && r.testDate) base.testDate = r.testDate
    if ((!base.terpenes || base.terpenes.length === 0) && r.terpenes) base.terpenes = r.terpenes
  }

  let conf = base.confidence || 10
  if (base.batchId) conf += 5
  if (base.strainName) conf += 5
  if (base.thcPercentage != null) conf += 20
  if (base.cbdPercentage != null) conf += 15
  if (base.totalCannabinoids != null) conf += 15
  if (base.testDate) conf += 10
  if (base.terpenes && base.terpenes.length) conf += 10
  if (base.thcPercentage != null && base.totalCannabinoids != null && Math.abs(base.totalCannabinoids - base.thcPercentage) <= 2) conf += 8

  base.confidence = Math.min(conf, 95)

  if (labType === '2river') {
    base.labName = base.labName || "2 RIVER LABS, INC"
    base.category = base.category || "INHALABLE"
    base.subCategory = base.subCategory || "FLOWER"
  }

  base.extractionMethod = 'combined_strategies'
  return base
}