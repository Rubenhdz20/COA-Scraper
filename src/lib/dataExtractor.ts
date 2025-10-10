/**
 * @interface ExtractedData
 * @description Defines the shape of the final structured data object that will be returned after parsing the OCR text.
 * It includes all the key information expected from a Certificate of Analysis (COA).
*/
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

/**
 * @interface MistralExtractionResponse
 * @description Defines the expected structure of a response from the Mistral AI API, specifically for chat completion.
 * This is used if a Large Language Model (LLM) is used for extraction.
*/
interface MistralExtractionResponse {
  choices: Array<{ message: { content: string } }>
}

/**
 * @interface ExtractionStrategy
 * @description Represents a single method or approach for extracting data from the OCR text.
 * Each strategy has a name and an `extract` function that implements its logic.
*/

interface ExtractionStrategy {
  name: string
  extract: (text: string) => ExtractedData
}

//
// MAIN ORCHESTRATOR
//

/**
 * @function extractDataFromOCRText
 * @description The main function that orchestrates the entire data extraction process.
 * It takes raw OCR text, detects the lab that produced the COA, runs a series of extraction strategies,
 * merges the results, and performs final cleanup and enrichment (like parsing terpenes) to produce a single, structured data object.
 * @param {string} ocrText - The raw text extracted from the document by an OCR service.
 * @returns {Promise<ExtractedData>} A promise that resolves to the final, structured data.
*/

export async function extractDataFromOCRText(ocrText: string): Promise<ExtractedData> {
  try {
    console.log('Starting COA data extraction')
    console.log('Text length:', ocrText.length)

    // 1. Detect the lab source to apply lab-specific logic.
    const labType = detectLabType(ocrText)
    console.log('Detected lab type:', labType)

    // 2. Get a list of extraction strategies, including a specific one if the lab is known.
    const strategies = getExtractionStrategies(labType)
    console.log('Using strategies:', strategies.map(s => s.name))

    // 3. Execute each strategy and collect the results.
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
      // Optimization: If a strategy returns a high-confidence, complete result, stop early.
      if (result.confidence >= 85 && hasCompleteDataLite(result)) {
        console.log('High confidence result found, stopping early')
        break
      }
    }

    // 4. Combine the results from all strategies into a single, more accurate object.
    const finalResult = combineResults(results, labType)

    // 5. TERPENE EXTRACTION: A dedicated, multi-step process to find and parse terpenes.
    // This is done after the main strategies because it's complex and can be handled separately.
    if (!finalResult.terpenes || finalResult.terpenes.length === 0) {
      // First, try to find a specific "terpene panel" section in the text.
      const terpPanel = findTerpenePanel(ocrText) // your helper that slices the "TERPENES BY GC-FID" section
      if (terpPanel) {
        console.log('✅ Terpene panel detected. Preview:', terpPanel.substring(0, 220))
        // If a panel is found, use a robust parser designed for table-like structures.
        let terps = extractTerpenesFromPanel(terpPanel) // your robust table-aware parser
        console.log('Parsed terpene candidates (panel):', terps)

        // If the table parser fails, fall back to a more general "loose text" scraper.
        if (!terps || terps.length === 0) {
          if (typeof extractTerpenesFromLooseText === 'function') {
            terps = extractTerpenesFromLooseText(terpPanel)
            console.log('Parsed terpene candidates (loose fallback):', terps)
          } else {
            console.log('Loose fallback not available; skipping.')
          }
        }

        if (terps && terps.length) {
          // If terpenes were found, sort them by percentage and keep the top 3.
          finalResult.terpenes = terps
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 3)

          // Give a small boost to the confidence score for successfully finding terpenes.
          finalResult.confidence = Math.min((finalResult.confidence || 0) + 8, 95)
          console.log('🌿 Top terpenes saved:', finalResult.terpenes)
        } else {
          console.log('Terpene panel present but no rows parsed.')
        }
      } else {
        console.log('No explicit terpene panel detected; skipping terpene parsing.')
      }
    } else {
      console.log('Terpenes already present from strategies; skipping panel parse.')
    }
    // --- END TERPENES ---

    // 6. Final check for a test date if it wasn't found by other strategies.
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
    // In case of a major error, return a low-confidence object with any info we have.
    return { confidence: 10, labName: detectLabName(ocrText) || "UNKNOWN LAB" }
  }
}

//
// LAB & STRATEGY DEFINITION
//

/**
 * @function detectLabType
 * @description Identifies the lab that produced the COA using simple regular expressions.
 * This allows for the use of lab-specific parsing logic.
 * @param {string} text - The OCR text.
 * @returns {string} A short identifier for the lab (e.g., '2river') or 'generic'.
*/


function detectLabType(text: string): string {
  if (/2\s*RIVER\s*LABS/i.test(text)) return '2river'
  if (/SC\s*LABS/i.test(text)) return 'sclabs'
  if (/STEEP\s*HILL/i.test(text)) return 'steephill'
  return 'generic'
}

/**
 * @function detectLabName
 * @description Extracts the full name of the lab from the text.
 * @param {string} text - The OCR text.
 * @returns {string | null} The full lab name or null if not found.
*/


function detectLabName(text: string): string | null {
  const labs = [/2\s*RIVER\s*LABS[^,\n]*/i, /SC\s*LABS[^,\n]*/i, /STEEP\s*HILL[^,\n]*/i]
  for (const p of labs) { const m = text.match(p); if (m) return m[0].trim() }
  return null
}

/**
 * @function getExtractionStrategies
 * @description A factory function that returns an array of extraction strategies to be used.
 * It includes a set of base strategies and prepends a lab-specific strategy if applicable.
 * @param {string} labType - The identifier for the detected lab.
 * @returns {ExtractionStrategy[]} An array of strategy objects.
*/

function getExtractionStrategies(labType: string): ExtractionStrategy[] {
  const base: ExtractionStrategy[] = [
    { name: 'structured_pattern', extract: structuredPatternExtraction },
    { name: 'numerical_analysis', extract: numericalAnalysisExtraction },
    { name: 'contextual_search', extract: contextualSearchExtraction }
  ]
  // If the lab is '2river', add its specific strategy to the front of the list to run first.
  if (labType === '2river') base.unshift({ name: '2river_specific', extract: river2SpecificExtraction })
  return base
}

//
// EXTRACTION STRATEGIES
//

/**
 * @function river2SpecificExtraction
 * @description A strategy tailored specifically for COAs from "2 River Labs".
 * It uses regex patterns that match the known layout and wording of their reports.
 * @param {string} text - The OCR text.
 * @returns {ExtractedData} The data extracted by this strategy.
*/


function river2SpecificExtraction(text: string): ExtractedData {
  const res: ExtractedData = {
    confidence: 40, 
    labName: "2 RIVER LABS, INC", 
    category: "INHALABLE", 
    extractionMethod: "2river_specific"
  }
  const clean = text.replace(/\s+/g, ' ').trim()

  // FIXED: Catch both EVM#### and EV#### patterns
  const batch = clean.match(/BATCH\s+ID\s*:?\s*(EV[M]?\d{4})/i)
  if (batch) { 
    res.batchId = batch[1]
    res.confidence += 15
    console.log(`✅ Batch ID: ${batch[1]}`)
  }

  // FIXED: More robust strain extraction
  const sample = clean.match(/SAMPLE\s*:?\s*([A-Z][A-Z\s&'-]+?)\s*\(?(?:FLOWER|\(FLOWER)/i)
  if (sample) { 
    res.strainName = sample[1].trim()
    res.confidence += 10
    console.log(`✅ Strain: ${sample[1].trim()}`)
  }

  if (/MATRIX:\s*FLOWER/i.test(text)) { 
    res.subCategory = 'FLOWER'
    res.confidence += 5 
  }

  // FIXED: Better cannabinoid extraction
  res.thcPercentage = extractCannabinoidValue(text, 'THC')
  res.cbdPercentage = extractCannabinoidValue(text, 'CBD')
  res.totalCannabinoids = extractCannabinoidValue(text, 'TOTAL CANNABINOIDS')

  if (res.thcPercentage != null) res.confidence += 25
  if (res.cbdPercentage != null) res.confidence += 20
  if (res.totalCannabinoids != null) res.confidence += 20

  const iso = extractTestDateISO(text)
  if (iso) { 
    res.testDate = iso
    res.confidence += 5 
  }

  // FIXED: Enhanced terpene extraction
  if (hasTerpenePanel(text)) {
    console.log('🌿 2River terpene panel detected')
    const terpPanel = findTerpenePanel(text)
    
    if (terpPanel) {
      let terpList = extractTerpenesFrom2RiverPanel(terpPanel)
      
      if (terpList.length === 0 && typeof extractTerpenesFromLooseText === 'function') {
        console.log('⚠️  Trying loose fallback...')
        terpList = extractTerpenesFromLooseText(terpPanel)
      }
      
      res.terpenes = terpList.slice(0, 3)
      
      if (terpList.length > 0) {
        res.confidence += 10
        console.log(`✅ Found ${terpList.length} terpenes`)
      }
    }
  }

  return res
}
/**

* @function hasTerpenePanel
 * @description A simple helper to quickly check if the text likely contains a terpene panel.
 * @param {string} s - The OCR text.
 * @returns {boolean} True if a terpene panel header is found.
*/

function hasTerpenePanel(s: string): boolean {
  return /M-0255[^:\n]*:\s*TERPENES?/i.test(s) || /TERPENES?\s+BY\s+GC/i.test(s)
}

/**
 * @function structuredPatternExtraction
 * @description A strategy that splits the document into sections and looks for cannabinoid data
 * within sections labeled "POTENCY" or "CANNABINOID".
 * @param {string} text - The OCR text.
 * @returns {ExtractedData} The data extracted by this strategy.
*/


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



/**
 * @function numericalAnalysisExtraction
 * @description A general-purpose strategy that finds all decimal numbers in the text and assumes they
 * are THC, CBD, or Total Cannabinoids based on whether they fall within a plausible range.
 * This is a "best guess" approach when other methods fail.
 * @param {string} text - The OCR text.
 * @returns {ExtractedData} The data extracted by this strategy.
*/

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

/**
 * @function contextualSearchExtraction
 * @description A strategy that searches for keywords (like 'THC', 'CBD') and then looks for a
 * numerical percentage value within a small window of text around that keyword.
 * @param {string} text - The OCR text.
 * @returns {ExtractedData} The data extracted by this strategy.
*/

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

//
// HELPER FUNCTIONS
//

// ----------------- Date helpers -----------------

/**
 * @function extractTestDateISO
 * @description Finds and parses a date from the text using various regex patterns.
 * It handles different date formats and converts the found date into a standardized ISO 8601 string.
 * @param {string} text - The OCR text.
 * @returns {string | undefined} The formatted date string or undefined if not found.
*/

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

/**
 * @function normalizeChemText
 * @description Cleans up chemical names by replacing common unicode characters and standardizing Greek letters.
 * @param {string} s - The raw chemical name string.
 * @returns {string} The normalized string.
*/

function normalizeChemText(s: string): string {
  return s
    .replace(/[\u2010-\u2015]/g, '-') // unicode dashes → -
    .replace(/\u00A0/g, ' ')          // NBSP → space
    .replace(/β/gi, 'BETA-')
    .replace(/α/gi, 'ALPHA-')
    .replace(/γ/gi, 'GAMMA-')
    .replace(/Δ/gi, 'DELTA-');
}

/**
 * @function amtTokenToPercent
 * @description Converts a value string (e.g., "5.1") into a percentage, considering its unit (e.g., 'mg/g').
 * @param {string} token - The string containing the numerical value.
 * @param {string} [unit] - The unit of the value (e.g., '%', 'mg/g').
 * @returns {number | null} The value as a percentage, or null if invalid.
*/


function amtTokenToPercent(token: string, unit?: string): number | null {
  if (!token) return null
  const raw = token.replace(/[^\d.<]/g, '').trim()
  if (!raw || /^ND$/i.test(raw)) return null
  if (/^<\s*LOQ$/i.test(raw)) return null
  // handle "<0.01" -> 0.01
  const numMatch = raw.match(/\d+(\.\d+)?/)
  if (!numMatch) return null
  const val = parseFloat(numMatch[0])
  if (!isFinite(val)) return null

  const u = (unit || '').toLowerCase()
  if (u.includes('%')) return val
  if (u.includes('mg/g')) return val * 0.1 // 1 mg/g = 0.1%
  if (u.includes('µg/g') || u.includes('μg/g') || u.includes('ug/g')) return val / 10000 // 1 μg/g = 0.0001%
  // If unit missing but the table is "AMT (%)", keep as %; if "AMT (mg/g)" we’ll also catch via header in row parser below.
  return val
}

/**
 * @function headerUnit
 * @description Parses the unit from a table header string (e.g., "AMT (%)").
 * @param {string} header - The header text.
 * @returns {string | undefined} The unit found, or undefined.
*/


function headerUnit(header: string): string | undefined {
  const m = header.match(/\(\s*([%μµu]g\/g|mg\/g|%)\s*\)/i)
  return m ? m[1] : undefined
}

/**
 * @function extractTerpenes
 * @description A comprehensive terpene parser that handles both markdown tables and plain text lines.
 * It identifies terpene names and their corresponding percentage values.
 * @param {string} text - The OCR text, ideally a slice containing just the terpene panel.
 * @returns {Array<{ name: string; percentage: number }>} An array of found terpenes, sorted by percentage.
*/


export function extractTerpenes(text: string): Array<{ name: string; percentage: number }> {
  const out: Record<string, number> = {}

  // 1) Prefer a terpene panel slice if you have a slicer; otherwise use the whole text
  const panel = sliceTerpenePanel(text) || text

  // Log a small preview to confirm we’re parsing what we think
  const preview = panel.slice(0, 600)
  console.log('🔎 Terpene panel preview:', preview)

  // 2) Try markdown table rows first
  // Find header row to know which column is AMT and its unit
  // Typical header: | ANALYTE | LIMIT | AMT (mg/g) | LOD/LOQ | PASS/FAIL |
  const tableRows = panel.split('\n').filter(l => l.includes('|'))
  let tableAmtUnit: string | undefined

  for (const row of tableRows) {
    if (/AMT/i.test(row)) {
      tableAmtUnit = headerUnit(row)
      break
    }
  }

  // Parse each row that looks like: | MYRCENE | ... | 0.45 | ... |
  for (const row of tableRows) {
    // skip separator rows like | --- | --- |
    if (/^\s*\|\s*-{2,}\s*\|/i.test(row)) continue

    const cells = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length < 3) continue

    // heuristics: first or second cell contains the analyte name
    const analyteCellIdx = /analyte/i.test(cells[0]) ? 1 : 0
    const amtIdx = cells.findIndex(c => /^(amt|amount)\b/i.test(c)) // rare if raw header per row
    const nameRaw = cells[analyteCellIdx] || ''
    const hasName = /(ene|ol|oxide|myrcene|limonene|pinene|terpinolene|caryophyllene|linalool|humulene|ocimene|bisabolol|nerolidol|camphene|eucalyptol|guaiol|terpinene|carene|cymene|geraniol)/i.test(nameRaw)
    if (!hasName) continue

    // choose a numeric-looking cell near the "AMT" column if present; else pick the first numeric cell
    let amtToken = ''
    let unit = tableAmtUnit

    // If header unit missing, try to infer unit from token
    const numericCell = cells.find(c => /(\d+(\.\d+)?)\s*(%|mg\/g|[μµu]g\/g)?/i.test(c) && !/limit|lod|loq|pass|fail|nd|<\s*loq/i.test(c))
    if (numericCell) {
      const m = numericCell.match(/(\d+(\.\d+)?)(\s*(%|mg\/g|[μµu]g\/g))?/i)
      if (m) {
        amtToken = m[1]
        unit = m[4] || unit
      }
    }

    // If still nothing, skip
    if (!amtToken) continue

    const pct = amtTokenToPercent(amtToken, unit)
    if (pct == null || pct <= 0) continue

    const pretty = normalizeTerpName(nameRaw)
    out[pretty] = Math.max(out[pretty] || 0, pct)
  }

  // 3) Fallback: plain text rows like "Myrcene 0.45 mg/g" or "β-Caryophyllene 0.21%"
  if (Object.keys(out).length === 0) {
    const lineRx = new RegExp(
      String.raw`\b([A-Zα-ωβγ\- ]{3,}?(?:myrcene|limonene|pinene|terpinolene|caryophyllene|linalool|humulene|ocimene|bisabolol|nerolidol|camphene|eucalyptol|guaiol|terpinene|carene|cymene|geraniol)[A-Zα-ωβγ\- ]*?)\b[^\n\r]{0,40}?(\d+(?:\.\d+)?)\s*(%|mg\/g|[μµu]g\/g)?`,
      'gi'
    )
    let m: RegExpExecArray | null
    while ((m = lineRx.exec(panel)) !== null) {
      const name = normalizeTerpName(m[1])
      const num = m[2]
      const unit = m[3]
      const pct = amtTokenToPercent(num, unit)
      if (pct != null && pct > 0) {
        out[name] = Math.max(out[name] || 0, pct)
      }
    }
  }

  // 4) Build, sanity filter and sort
  const arr = Object.entries(out)
    .map(([name, percentage]) => ({ name, percentage }))
    .filter(t => t.percentage > 0 && t.percentage < 20)
    .sort((a, b) => b.percentage - a.percentage)

  console.log('Parsed terpene candidates:', arr.slice(0, 10))
  return arr
}

/**
 * @function sliceTerpenePanel
 * @description Tries to find and return only the portion of the text that contains the terpene analysis,
 * improving the precision of the terpene parser.
 * @param {string} text - The full OCR text.
 * @returns {string | null} A slice of the text containing the terpene panel, or null.
*/


function sliceTerpenePanel(text: string): string | null {
  // Look for common headers
  const idx =
    text.search(/M-0255[^:\n]*:\s*TERPENES?/i) >= 0
      ? text.search(/M-0255[^:\n]*:\s*TERPENES?/i)
      : text.search(/TERPENES?\s+BY\s+GC/i)

  if (idx < 0) return null

  // End at next method "M-0xxx", next page, or big header
  const rest = text.slice(idx)
  const endMatch = rest.search(/\n\s*M-\d{3}[A-Z]?:|=== PAGE \d+ ===|##\s*[A-Z]/i)
  const panel = endMatch > 0 ? rest.slice(0, endMatch) : rest.slice(0, 2500)

  // If panel is just an image tag, extend a bit more in case markdown split
  if (/\!\[img/i.test(panel) && panel.length < 120) {
    return text.slice(idx, idx + 3000)
  }
  return panel
}

/**
 * @constant ROW_WITH_PERCENT
 * @description A regex to detect a line that looks like a whitespace-separated table row containing a percentage.
*/

const ROW_WITH_PERCENT =
  /^\s*([A-Z0-9α-ωβγΔ\-\s\.]+?)\s+(?:AMT:?\s*)?(\d+(?:\.\d+)?)\s*%\b/i;

/**
 * @constant PIPE_ROW
 * @description A regex to detect a line that looks like a pipe-separated markdown table row.
*/

const PIPE_ROW =
  /^\s*([A-Z0-9α-ωβγΔ\-\s\.]+?)\s*\|\s*(?:ND|<\s*LOQ|(\d+(?:\.\d+)?)\s*%)\b/i;

/**
 * @function getTerpenePanelSlice
 * @description An alternative function to find and slice the terpene panel from the text.
 * @param {string} text - The full OCR text.
 * @returns {string | null} The sliced text or null.
*/

function getTerpenePanelSlice(text: string): string | null {
  // capture from the terpene header to the next page/header
  const m = text.match(
    /(M[-\s]*0?25[5S]\s*:\s*)?TERPENES\s+BY\s+GC[-\s]*FID[\s\S]{0,4000}?(?=\n=== PAGE|\n#\s|$)/i
  );
  return m ? m[0] : null;
}

/**
 * @function extractTerpenesFromPanel
 * @description A core parser for extracting terpenes from a pre-sliced panel. It iterates through lines,
 * attempting to match either pipe-style or whitespace-style table rows to find terpene names and values.
 * @param {string} panel - The text slice containing the terpene panel.
 * @returns {Array<{ name: string; percentage: number }>} An array of the top 3 terpenes found.
*/

function extractTerpenesFromPanel(panel: string): Array<{ name: string; percentage: number }> {
  const out: Array<{ name: string; percentage: number }> = [];
  const seen = new Map<string, number>();

  // split by real lines; keep them intact
  const lines = panel.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // skip header/columns
    if (/^(ANALYTE|AMT|LOD\/LOQ|PASS\/FAIL)\b/i.test(line)) continue;
    if (/^TOTAL\s+TERPENES\b/i.test(line)) continue;

    // skip non-quant rows quickly
    if (/\b(ND|<\s*LOQ)\b/i.test(line)) continue;

    // try pipe-style table row first
    let m = line.match(PIPE_ROW);
    if (!m) {
      // then try whitespace table row
      m = line.match(ROW_WITH_PERCENT);
    }
    if (!m) continue;

    const rawName = m[1] ?? '';
    const pctStr  = (m[2] ?? '').replace(',', '.');
    const pct     = pctStr ? parseFloat(pctStr) : NaN;

    if (!isFinite(pct) || pct <= 0 || pct >= 20) continue; // sanity + ignore totals

    const name = normalizeTerpName(rawName);
    if (!name || /TERPENES BY GC[-\s]*FID/i.test(name)) continue;

    // keep max in case of duplicates
    const prev = seen.get(name) ?? 0;
    if (pct > prev) seen.set(name, pct);
  }

  for (const [name, percentage] of seen) out.push({ name, percentage });

  // sort desc and take top 3
  out.sort((a, b) => b.percentage - a.percentage);
  return out.slice(0, 3);
}

function extractTerpenesFrom2RiverPanel(panel: string): Array<{ name: string; percentage: number }> {
  const results: Map<string, number> = new Map()
  
  console.log('\n=== 2RIVER TERPENE EXTRACTION ===')
  console.log('Panel length:', panel.length)
  console.log('Panel preview (first 600 chars):\n', panel.substring(0, 600))


  // ADD THIS DIAGNOSTIC SECTION ⬇️⬇️⬇️
  console.log('\n=== DIAGNOSTIC: First 15 lines ===')
  const lines = panel.split('\n')
  lines.slice(0, 15).forEach((line, i) => {
    console.log(`Line ${i}: "${line}"`)
  })

   // Check what format we're receiving
  const hasCommaFormat = /,/.test(panel)
  const hasPercentages = /\d+\.\d+\s*%/.test(panel)
  const hasMgG = /\d+\.\d+\s*mg\/g/i.test(panel)
  
  console.log('\nFormat detection:')
  console.log('  Has commas:', hasCommaFormat)
  console.log('  Has percentages:', hasPercentages)
  console.log('  Has mg/g:', hasMgG)
  console.log('=== END DIAGNOSTIC ===\n')
  // END DIAGNOSTIC SECTION ⬆️⬆️⬆️

  let parsedCount = 0
  
  for (const line of lines) {
    // Skip headers and non-data
    if (/ANALYTE|AMT|LOD|LOQ|PASS|FAIL|TOTAL TERPENES|M-025S/i.test(line)) continue
    if (line.trim().length < 10) continue
    if (/^[\s|_\-]+$/.test(line)) continue
    
    // FIXED: Flexible regex for terpene rows
    // Handles both Greek (β, α) and ASCII (BETA-, ALPHA-)
    // Format: "β-MYRCENE     0.483 %  4.83 mg/g"
    // Format: "D-LIMONENE    0.514 %  5.14 mg/g"
    const match = line.match(/^([βαγΔA-Z][\wβαγΔ\-\s]+?)\s{2,}(\d+\.?\d*)\s*%/i)
    
    if (match) {
      const rawName = match[1].trim()
      const percentage = parseFloat(match[2])
      
      // Skip ND or < LOQ values
      if (/\bND\b|<\s*LOQ/i.test(line)) continue
      
      // Validate percentage range
      if (percentage > 0 && percentage < 20) {
        const normalizedName = normalizeTerpName(rawName)
        
        // Validate it's a real terpene name (not junk)
        if (normalizedName.length >= 4 && /[A-Za-z]/.test(normalizedName)) {
          console.log(`  ✅ Line: "${line.substring(0, 70)}"`)
          console.log(`     Parsed: ${normalizedName} = ${percentage}%`)
          results.set(normalizedName, Math.max(results.get(normalizedName) || 0, percentage))
          parsedCount++
        }
      }
    }
  }
  
  console.log(`\nParsed ${parsedCount} terpene rows`)
  
  const terpenes = Array.from(results.entries())
    .map(([name, percentage]) => ({ name, percentage }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3)
  
  console.log('\n=== TOP 3 TERPENES ===')
  if (terpenes.length === 0) {
    console.log('❌ No terpenes extracted')
  } else {
    terpenes.forEach((t, i) => console.log(`${i + 1}. ${t.name}: ${t.percentage}%`))
  }
  
  return terpenes
}

// ----------------- Terpene panel parsing -----------------

/**
 * @function findTerpenePanel
 * @description A robust function to find the terpene panel using multiple common headers.
 * @param {string} text - The full OCR text.
 * @returns {string | null} The sliced text of the panel or null.
*/

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

/**
 * @function normalizeTerpName
 * @description Standardizes terpene names by cleaning them, handling prefixes (like 'β-'),
 * and mapping common variations to a canonical name (e.g., 'beta-myrcene' -> 'Myrcene').
 * @param {string} raw - The raw terpene name from the text.
 * @returns {string} The standardized terpene name.
*/


function normalizeTerpName(raw: string): string {
  let n = raw
    // Normalize Greek letters (keep them but clean spacing)
    .replace(/β\s*-?\s*/gi, 'β-')
    .replace(/α\s*-?\s*/gi, 'α-')
    .replace(/γ\s*-?\s*/gi, 'γ-')
    .replace(/Δ\s*-?\s*/gi, 'Δ-')
    // Also handle ASCII versions if they sneak in
    .replace(/BETA\s*-?\s*/gi, 'β-')
    .replace(/ALPHA\s*-?\s*/gi, 'α-')
    .replace(/GAMMA\s*-?\s*/gi, 'γ-')
    .replace(/DELTA\s*-?\s*/gi, 'Δ-')
    // Clean whitespace and dashes
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/-+/g, '-')
    .trim()
  
  // Remove trailing dash
  n = n.replace(/-$/, '')
  
  // Capitalize each part (except Greek letters)
  const parts = n.split('-')
  return parts.map(part => {
    if (/^[βαγΔ]$/.test(part)) return part // Keep Greek as-is
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  }).join('-')
}

/**
 * @function parseAmtToPercent
 * @description Parses a string that represents an amount and converts it to a percentage.
 * It handles different formats like '0.514 %', '5.14 mg/g', 'ND', and '< LOQ'.
 * @param {string} amt - The amount string.
 * @returns {number | null} The value as a percentage or null if not parsable.
*/


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

// Add to dataExtractor.ts for debugging
function diagnoseTerpeneSection(text: string) {
  const panel = findTerpenePanel(text)
  if (!panel) {
    console.log('❌ No terpene panel found')
    return
  }
  
  console.log('=== TERPENE PANEL DIAGNOSIS ===')
  console.log('Panel length:', panel.length)
  console.log('First 800 chars:')
  console.log(panel.substring(0, 800))
  
  const lines = panel.split('\n').slice(0, 20)
  console.log('\nFirst 20 lines:')
  lines.forEach((line, i) => {
    console.log(`${i}: "${line}"`)
  })
  
  console.log('\nGreek letter check:')
  console.log('Contains β:', /β/.test(panel))
  console.log('Contains BETA:', /BETA/i.test(panel))
  console.log('Contains α:', /α/.test(panel))
  console.log('Contains ALPHA:', /ALPHA/i.test(panel))
}

/**
 * @function extractTerpenesFromLooseText
 * @description A fallback scraper for terpenes used when a structured panel cannot be parsed.
 * It scans the text for known terpene names and then looks for a numerical value nearby.
 * This is less precise but effective as a backup.
 * @param {string} text - The text to scrape.
 * @returns {Array<{ name: string; percentage: number }>} An array of found terpenes.
*/


function extractTerpenesFromLooseText(text: string): Array<{ name: string; percentage: number }> {
  // 1) Normalize text so names are detectable
  let t = text
    // greek → ascii families
    .replace(/β/gi, 'BETA-')
    .replace(/α/gi, 'ALPHA-')
    .replace(/γ/gi, 'GAMMA-')
    .replace(/Δ/gi, 'DELTA-')
    // remove excessive spaces around hyphens/slashes/colons
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*:\s*/g, ':')
    // collapse “D - L I M O N E N E” or “B - P I N E N E”
    .replace(/\b([A-Z])(?:\s+[A-Z])+\b/g, (m) => m.replace(/\s+/g, ''));

  // Also try to collapse “ALPHA - PINENE” → “ALPHA-PINENE”
  t = t.replace(/\b(ALPHA|BETA|GAMMA|DELTA)\s*-\s*([A-Z]+)\b/g, '$1-$2');

  // 2) Canonical terpene dictionary (add more as you need)
  const TERPENES: Record<string, RegExp> = {
    'D-LIMONENE': /\b(D[-\s]*LIMONENE|LIMONENE)\b/i,
    'BETA-MYRCENE': /\b([βΒ][-\s]*MYRCENE|BETA[-\s]*MYRCENE|MYRCENE)\b/i,
    'BETA-CARYOPHYLLENE': /\b([βΒ][-\s]*CARYOPHYLLENE|BETA[-\s]*CARYOPHYLLENE|CARYOPHYLLENE)\b/i,
    'LINALOOL': /\bLINALOOL\b/i,
    'ALPHA-HUMULENE': /\b(ALPHA[-\s]*HUMULENE|[αΑ][-\s]*HUMULENE|HUMULENE)\b/i,
    'TRANS-NEROLIDOL': /\b(TRANS-?NEROLIDOL|T-NEROLIDOL)\b/i,
    'BETA-PINENE': /\b(BETA-?PINENE|B-PINENE)\b/i,
    'ALPHA-PINENE': /\b(ALPHA[-\s]*PINENE|[αΑ][-\s]*PINENE|A-PINENE)\b/i,
    'ALPHA-BISABOLOL': /\b(ALPHA-?BISABOLOL|BISABOLOL)\b/i,
    'CAMPHENE': /\bCAMPHENE\b/i,
    'CARYOPHYLLENE OXIDE': /\bCARYOPHYLLENE\s+OXIDE\b/i,
    'TERPINOLENE': /\bTERPINOLENE\b/i,
    'GAMMA-TERPINENE': /\b(GAMMA-?TERPINENE|G-TERPINENE)\b/i,
    'P-CYMENE': /\bP-?CYMENE\b/i,
    'CIS-OCIMENE': /\bCIS-?OCIMENE\b/i,
    'TRANS-OCIMENE': /\bTRANS-?OCIMENE\b/i,
    'CIS-NEROLIDOL': /\bCIS-?NEROLIDOL\b/i,
    'GERANIOL': /\bGERANIOL\b/i,
    'EUCALYPTOL': /\bEUCALYPTOL\b/i,
    'GUAIOL': /\bGUAIOL\b/i,
    'ISOPULEGOL': /\bISOPULEGOL\b/i,
    'DELTA-3-CARENE': /\b(DELTA-?3-?CARENE|D3-?CARENE)\b/i,
  };

  // Helper: find nearest % or mg/g value in a small window
  function findValueNear(idx: number): number | null {
    const window = t.slice(Math.max(0, idx - 120), idx + 160);

    // If ND or < LOQ near the name, skip
    if (/\bND\b|<\s*LOQ/i.test(window)) return null;

    // Prefer percent (e.g., 0.514 %)
    const pct = window.match(/(\d+\.?\d*)\s*%/);
    if (pct) {
      const v = parseFloat(pct[1]);
      if (isFinite(v) && v > 0 && v < 20) return v;
    }

    // Else accept mg/g and convert to %
    // (1% = 10 mg/g ⇒ % = mg/g / 10)
    const mg = window.match(/(\d+\.?\d*)\s*mg\/g/i);
    if (mg) {
      const mgVal = parseFloat(mg[1]);
      if (isFinite(mgVal) && mgVal > 0 && mgVal < 200) {
        const pctVal = mgVal / 10;
        if (pctVal > 0 && pctVal < 20) return pctVal;
      }
    }

    return null;
  }

  const results: Record<string, number> = {};

  // 3) Scan for each terpene and grab the best nearby value
  for (const [pretty, rx] of Object.entries(TERPENES)) {
    let m: RegExpExecArray | null;
    const global = new RegExp(rx, rx.ignoreCase ? 'gi' : 'g');

    while ((m = global.exec(t)) !== null) {
      const val = findValueNear(m.index);
      if (val != null) {
        results[pretty] = Math.max(results[pretty] || 0, val);
      }
    }
  }

  // 4) Build array, filter/sort, return top 5
  const arr = Object.entries(results)
    .map(([name, percentage]) => ({ name, percentage }))
    .filter(x => x.percentage > 0 && x.percentage < 20)
    .sort((a, b) => b.percentage - a.percentage);

  console.log('Loose terpene scrape results:', arr.slice(0, 8));
  return arr.slice(0, 5);
}

// ----------------- Cannabinoid helpers -----------------

/**
 * @function extractCannabinoidValue
 * @description Finds a cannabinoid value using a series of regex patterns.
 * @param {string} text - The OCR text.
 * @param {string} cannabinoidType - The type of cannabinoid to look for (e.g., 'THC').
 * @returns {number | undefined} The found value or undefined.
*/


function extractCannabinoidValue(text: string, cannabinoidType: string): number | undefined {
  console.log(`\n=== Extracting ${cannabinoidType} ===`)
  
  // Strategy 1: CANNABINOID OVERVIEW section
  const overviewMatch = text.match(/CANNABINOID\s+OVERVIEW[\s\S]{0,1200}?(?=CULTIVATOR|DISTRIBUTOR|BATCH RESULT)/i)
  if (overviewMatch) {
    const overviewSection = overviewMatch[0]
    console.log('Found CANNABINOID OVERVIEW section')
    console.log('Overview preview:', overviewSection.substring(0, 300)) // ADD THIS
    
    // FIXED: Allow 1-4 digits after decimal, but prevent year capture
    const totalPattern = new RegExp(
      `TOTAL\\s+${cannabinoidType}\\s*:\\s*(\\d{1,2}\\.\\d{1,4})\\s*%(?!\\s*\\d{4})`, 
      'i'
    )
    const match = overviewSection.match(totalPattern)
    
    if (match) {
      const value = parseFloat(match[1])
      console.log(`✅ Found ${cannabinoidType} in overview: ${value}%`)
      
      // STRICT: Reject if value looks like a date (> 100 or contains year pattern)
      if (value > 0 && value <= 50 && isValidCannabinoidValue(value, cannabinoidType)) {
        return value
      } else {
        console.log(`⚠️  Value ${value} rejected (likely invalid: out of 0-50 range)`)
      }
    } else {
      console.log(`⚠️  No match for TOTAL ${cannabinoidType} pattern in overview`)
    }
  }

  // Strategy 2: M-024 POTENCY table
  const potencyMatch = text.match(/M-024:\s*POTENCY[\s\S]{0,800}?(?=M-\d{3}|REGULATORY|$)/i)
  if (potencyMatch) {
    const potencySection = potencyMatch[0]
    console.log('Found M-024 POTENCY section')
    
    const tablePattern = new RegExp(
      `TOTAL\\s+${cannabinoidType}\\s*\\*{0,2}\\s+(\\d{1,2}\\.\\d{1,4})\\s*%(?!\\s*\\d{4})`, 
      'i'
    )
    const match = potencySection.match(tablePattern)
    
    if (match) {
      const value = parseFloat(match[1])
      console.log(`✅ Found ${cannabinoidType} in table: ${value}%`)
      if (value > 0 && value <= 50 && isValidCannabinoidValue(value, cannabinoidType)) {
        return value
      }
    }
  }

  console.log(`❌ No valid ${cannabinoidType} found`)
  return undefined
}

/**
 * @function isValidCannabinoidValue
 * @description Checks if a given value is a plausible percentage for a given cannabinoid type.
 * This helps filter out incorrect matches.
 * @param {number} value - The numerical value.
 * @param {string} type - The cannabinoid type.
 * @returns {boolean} True if the value is valid.
*/


function isValidCannabinoidValue(value: number, type: string): boolean {
  if (!isFinite(value) || value < 0) return false
  
  // ENHANCED: Stricter validation
  switch (type.toUpperCase()) {
    case 'THC': 
      return value >= 0.01 && value <= 40 // THC rarely exceeds 40%
    case 'CBD': 
      return value >= 0.001 && value <= 30
    case 'TOTAL CANNABINOIDS':
      return value >= 0.01 && value <= 45 // Slightly higher than THC
    default: 
      return value <= 100
  }
}

/**
 * @function parseStructuredCannabinoids
 * @description Parses cannabinoid values from a section of text that is known to contain them.
 * @param {string} section - The text slice of the cannabinoid section.
 * @returns {object} An object containing the found thc, cbd, and total values.
*/


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

/**
 * @function findValueInContext
 * @description A helper for the contextual search strategy. Finds a keyword and then looks for a percentage value nearby.
 * @param {string} text - The full OCR text.
 * @param {string} keyword - The keyword to search for.
 * @param {number} [windowSize=100] - The number of characters to look around the keyword.
 * @returns {number | undefined} The found value or undefined.
*/


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

/**
 * @function hasCompleteDataLite
 * @description A quick check to see if the most important data points (THC and Total Cannabinoids) have been found.
 * Used to decide if the extraction process can stop early.
 * @param {ExtractedData} r - A data result object.
 * @returns {boolean} True if the essential data is present.
*/


function hasCompleteDataLite(r: ExtractedData): boolean {
  return !!(r.thcPercentage != null && r.totalCannabinoids != null)
}

/**
 * @function combineResults
 * @description Merges the results from multiple extraction strategies into a single, more reliable object.
 * It prioritizes the result with the highest initial confidence and then fills in any missing fields from other results.
 * It also recalculates a final confidence score based on the completeness of the merged data.
 * @param {ExtractedData[]} results - An array of result objects from the strategies.
 * @param {string} labType - The detected lab type, used for final enrichment.
 * @returns {ExtractedData} The final, merged data object.
*/


function combineResults(results: ExtractedData[], labType: string): ExtractedData {
  if (!results.length) return { confidence: 10, labName: "UNKNOWN LAB" }
  // Start with the result that has the highest confidence score.
  const sorted = results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  const base: ExtractedData = { ...sorted[0] }

  // Iterate through the other results and fill in any missing data.
  for (const r of sorted.slice(1)) {
    if (!base.batchId && r.batchId) base.batchId = r.batchId
    if (!base.strainName && r.strainName) base.strainName = r.strainName
    if (base.thcPercentage == null && r.thcPercentage != null) base.thcPercentage = r.thcPercentage
    if (base.cbdPercentage == null && r.cbdPercentage != null) base.cbdPercentage = r.cbdPercentage
    if (base.totalCannabinoids == null && r.totalCannabinoids != null) base.totalCannabinoids = r.totalCannabinoids
    if (!base.testDate && r.testDate) base.testDate = r.testDate
    if ((!base.terpenes || base.terpenes.length === 0) && r.terpenes) base.terpenes = r.terpenes
  }

  // Recalculate the confidence score based on how complete the final object is.
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

  // Add any final, lab-specific default values.
  if (labType === '2river') {
    base.labName = base.labName || "2 RIVER LABS, INC"
    base.category = base.category || "INHALABLE"
    base.subCategory = base.subCategory || "FLOWER"
  }

  base.extractionMethod = 'combined_strategies'
  return base
}