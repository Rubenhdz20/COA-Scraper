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
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface ExtractionStrategy {
  name: string
  extract: (text: string) => ExtractedData
}

// Core extraction engine with configurable strategies
export async function extractDataFromOCRText(ocrText: string): Promise<ExtractedData> {
  try {
    console.log('Starting COA data extraction')
    console.log('Text length:', ocrText.length)

    // Determine lab type for strategy selection
    const labType = detectLabType(ocrText)
    console.log('Detected lab type:', labType)

    // Get appropriate extraction strategies
    const strategies = getExtractionStrategies(labType)
    console.log('Using strategies:', strategies.map(s => s.name))

    // Execute strategies in order
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
        terpenes: result.terpenes?.length || 0,
        confidence: result.confidence
      })
      
      // Early exit if we have high-confidence results
      if (result.confidence >= 85 && hasCompleteData(result)) {
        console.log('High confidence result found, stopping early')
        break
      }
    }

    // Combine results using intelligent merging
    const finalResult = combineResults(results, labType)
    
    // AI enhancement if needed
    if (shouldUseAIEnhancement(finalResult)) {
      console.log('\nApplying AI enhancement')
      const aiResult = await enhanceWithAI(ocrText, finalResult)
      finalResult = combineResults([finalResult, aiResult], labType)
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

// Lab detection for strategy selection
function detectLabType(text: string): string {
  if (/2\s*RIVER\s*LABS/i.test(text)) return '2river'
  if (/SC\s*LABS/i.test(text)) return 'sclabs'
  if (/STEEP\s*HILL/i.test(text)) return 'steephill'
  return 'generic'
}

function detectLabName(text: string): string | null {
  const labPatterns = [
    /2\s*RIVER\s*LABS[^,\n]*/i,
    /SC\s*LABS[^,\n]*/i,
    /STEEP\s*HILL[^,\n]*/i
  ]
  
  for (const pattern of labPatterns) {
    const match = text.match(pattern)
    if (match) return match[0].trim()
  }
  
  return null
}

// Strategy factory
function getExtractionStrategies(labType: string): ExtractionStrategy[] {
  const baseStrategies: ExtractionStrategy[] = [
    { name: 'structured_pattern', extract: structuredPatternExtraction },
    { name: 'numerical_analysis', extract: numericalAnalysisExtraction },
    { name: 'contextual_search', extract: contextualSearchExtraction }
  ]

  // Add lab-specific strategies
  if (labType === '2river') {
    baseStrategies.unshift({ name: '2river_specific', extract: river2SpecificExtraction })
  }

  return baseStrategies
}

// Strategy 1: 2River Labs specific patterns
function river2SpecificExtraction(text: string): ExtractedData {
  const result: ExtractedData = {
    confidence: 40,
    labName: "2 RIVER LABS, INC",
    category: "INHALABLE",
    extractionMethod: "2river_specific"
  }

  // Clean text for better matching
  const cleanText = text.replace(/\s+/g, ' ').trim()

  // Extract batch ID - 2River uses EVM#### format
  const batchMatch = cleanText.match(/(?:BATCH\s*ID\s*:?\s*)?(EVM\d{4})/i)
  if (batchMatch) {
    result.batchId = batchMatch[1]
    result.confidence += 15
  }

  // Extract strain name from SAMPLE line
  const sampleMatch = cleanText.match(/SAMPLE\s*:\s*([A-Z][A-Z\s&-]+?)\s*\(?FLOWER/i)
  if (sampleMatch) {
    result.strainName = sampleMatch[1].trim()
    result.confidence += 10
  }

  // Set sub-category for flower products
  if (/FLOWER|MATRIX:\s*FLOWER/i.test(text)) {
    result.subCategory = 'FLOWER'
    result.confidence += 5
  }

  // 2River cannabinoid extraction using multiple approaches
  result.thcPercentage = extractCannabinoidValue(cleanText, 'THC')
  result.cbdPercentage = extractCannabinoidValue(cleanText, 'CBD')
  result.totalCannabinoids = extractCannabinoidValue(cleanText, 'TOTAL CANNABINOIDS')

  // Add confidence for found cannabinoids
  if (result.thcPercentage) result.confidence += 25
  if (result.cbdPercentage !== undefined) result.confidence += 20
  if (result.totalCannabinoids) result.confidence += 20

  // Extract test date - NEW!
  result.testDate = extractTestDate(text)
  if (result.testDate) {
    result.confidence += 5
    console.log('Extracted test date:', result.testDate)
  }

  // Extract terpenes - ENHANCED!
  result.terpenes = extractTerpenes(text)
  if (result.terpenes && result.terpenes.length > 0) {
    result.confidence += 10
    console.log('Extracted terpenes:', result.terpenes)
  }

  return result
}

// Strategy 2: Structured pattern matching
function structuredPatternExtraction(text: string): ExtractedData {
  const result: ExtractedData = {
    confidence: 30,
    extractionMethod: "structured_pattern"
  }

  // Look for structured sections
  const sections = text.split(/\n(?=[A-Z-]+:|M-\d+:|##)/g)
  
  for (const section of sections) {
    // Look for potency sections
    if (/POTENCY|CANNABINOID/i.test(section)) {
      const cannabinoids = parseStructuredCannabinoids(section)
      if (cannabinoids.thc) result.thcPercentage = cannabinoids.thc
      if (cannabinoids.cbd !== undefined) result.cbdPercentage = cannabinoids.cbd
      if (cannabinoids.total) result.totalCannabinoids = cannabinoids.total
      
      if (cannabinoids.thc || cannabinoids.cbd !== undefined || cannabinoids.total) {
        result.confidence += 30
      }
    }

    // Look for terpene sections
    if (/TERPENE/i.test(section)) {
      result.terpenes = extractTerpenes(section)
      if (result.terpenes.length > 0) result.confidence += 15
    }

    // Look for date information
    if (!result.testDate) {
      result.testDate = extractTestDate(section)
      if (result.testDate) result.confidence += 5
    }
  }

  return result
}

// Strategy 3: Numerical analysis
function numericalAnalysisExtraction(text: string): ExtractedData {
  const result: ExtractedData = {
    confidence: 25,
    extractionMethod: "numerical_analysis"
  }

  // Extract all decimal numbers
  const decimals = text.match(/\d+\.\d+/g) || []
  
  // Analyze numbers for cannabinoid patterns
  for (const decimal of decimals) {
    const value = parseFloat(decimal)
    
    // THC typically 15-35% for flower
    if (value >= 15 && value <= 35 && !result.thcPercentage) {
      result.thcPercentage = value
      result.confidence += 20
    }
    
    // CBD typically 0.01-5% for most flower
    if (value >= 0.01 && value <= 5 && !result.cbdPercentage) {
      result.cbdPercentage = value
      result.confidence += 15
    }
    
    // Total cannabinoids should be close to THC + CBD
    if (value >= 15 && value <= 40 && !result.totalCannabinoids) {
      // Validate against THC if we have it
      if (!result.thcPercentage || Math.abs(value - result.thcPercentage) <= 5) {
        result.totalCannabinoids = value
        result.confidence += 15
      }
    }
  }

  // Try to extract date
  result.testDate = extractTestDate(text)
  if (result.testDate) result.confidence += 5

  return result
}

// Strategy 4: Contextual search
function contextualSearchExtraction(text: string): ExtractedData {
  const result: ExtractedData = {
    confidence: 20,
    extractionMethod: "contextual_search"
  }

  // Search for cannabinoids in context windows
  const contextWindows = [
    { keyword: 'THC', field: 'thcPercentage' },
    { keyword: 'CBD', field: 'cbdPercentage' },
    { keyword: 'CANNABINOID', field: 'totalCannabinoids' }
  ]

  for (const window of contextWindows) {
    const value = findValueInContext(text, window.keyword)
    if (value) {
      result[window.field as keyof ExtractedData] = value as any
      result.confidence += 15
    }
  }

  // Extract test date
  result.testDate = extractTestDate(text)
  if (result.testDate) result.confidence += 5

  // Extract terpenes
  result.terpenes = extractTerpenes(text)
  if (result.terpenes && result.terpenes.length > 0) result.confidence += 10

  return result
}

// NEW HELPER: Extract test date from text
function extractTestDate(text: string): string | undefined {
  // Multiple date patterns to try, in order of specificity
  const patterns = [
    // Format: PRODUCED: JAN 17.2024 or JAN 17, 2024
    {
      regex: /PRODUCED\s*:?\s*([A-Z]{3})\s+(\d{1,2})[,.\s]+(\d{4})/i,
      priority: 10
    },
    // Format: TEST DATE: month day year
    {
      regex: /TEST\s+DATE\s*:?\s*([A-Z]{3})\s+(\d{1,2})[,.\s]+(\d{4})/i,
      priority: 9
    },
    // Format: TESTED: month day year
    {
      regex: /TESTED\s*:?\s*([A-Z]{3})\s+(\d{1,2})[,.\s]+(\d{4})/i,
      priority: 8
    },
    // Format in test headers: M-###: ... // JAN 15.2024
    {
      regex: /M-\d+[A-Z]?:[^\/]*\/\/\s*([A-Z]{3})\s+(\d{1,2})[,.\s]+(\d{4})/i,
      priority: 7
    },
    // Format: POTENCY BY HPLC // JAN 15.2024
    {
      regex: /POTENCY[^\/]*\/\/\s*([A-Z]{3})\s+(\d{1,2})[,.\s]+(\d{4})/i,
      priority: 6
    },
    // Format: Date with slashes MM/DD/YYYY or MM/DD/YY
    {
      regex: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
      priority: 5,
      transform: (match: RegExpMatchArray) => {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
        const month = months[parseInt(match[1]) - 1] || match[1]
        const day = match[2]
        const year = match[3].length === 2 ? '20' + match[3] : match[3]
        return `${month} ${day}, ${year}`
      }
    }
  ]

  // Try patterns in order of priority
  let bestMatch: { date: string; priority: number } | null = null

  for (const pattern of patterns) {
    const match = text.match(pattern.regex)
    if (match) {
      let date: string
      
      if (pattern.transform) {
        date = pattern.transform(match)
      } else {
        const month = match[1]
        const day = match[2]
        const year = match[3]
        date = `${month} ${day}, ${year}`
      }
      
      if (!bestMatch || pattern.priority > bestMatch.priority) {
        bestMatch = { date, priority: pattern.priority }
      }
    }
  }

  return bestMatch?.date
}

// ENHANCED HELPER: Extract terpenes with better pattern matching
function extractTerpenes(text: string): Array<{ name: string; percentage: number }> {
  const terpenes: Map<string, number> = new Map()
  
  // Try to find terpene section first
  const terpeneSection = text.match(/(?:TERPENE|M-0255)[^]*?(?=\n\n|\nM-\d+|PAGE|$)/i)?.[0] || text
  
  // Common terpene names with variations
  const terpenePatterns: Array<{ name: string; patterns: string[] }> = [
    { name: 'Myrcene', patterns: ['MYRCENE', 'BETA-MYRCENE', 'β-MYRCENE'] },
    { name: 'Limonene', patterns: ['LIMONENE', 'D-LIMONENE'] },
    { name: 'Caryophyllene', patterns: ['CARYOPHYLLENE', 'BETA-CARYOPHYLLENE', 'β-CARYOPHYLLENE'] },
    { name: 'Pinene', patterns: ['PINENE', 'ALPHA-PINENE', 'BETA-PINENE', 'α-PINENE', 'β-PINENE'] },
    { name: 'Linalool', patterns: ['LINALOOL'] },
    { name: 'Humulene', patterns: ['HUMULENE', 'ALPHA-HUMULENE', 'α-HUMULENE'] },
    { name: 'Terpinolene', patterns: ['TERPINOLENE'] },
    { name: 'Ocimene', patterns: ['OCIMENE', 'BETA-OCIMENE', 'TRANS-OCIMENE', 'CIS-OCIMENE'] },
    { name: 'Bisabolol', patterns: ['BISABOLOL', 'ALPHA-BISABOLOL', 'α-BISABOLOL'] },
    { name: 'Terpinene', patterns: ['TERPINENE', 'ALPHA-TERPINENE', 'GAMMA-TERPINENE'] },
    { name: 'Camphene', patterns: ['CAMPHENE'] },
    { name: 'Carene', patterns: ['CARENE', 'DELTA-3-CARENE', '3-CARENE'] },
    { name: 'Eucalyptol', patterns: ['EUCALYPTOL', '1,8-CINEOLE'] },
    { name: 'Geraniol', patterns: ['GERANIOL'] },
    { name: 'Guaiol', patterns: ['GUAIOL'] },
    { name: 'Nerolidol', patterns: ['NEROLIDOL', 'TRANS-NEROLIDOL', 'CIS-NEROLIDOL'] }
  ]
  
  for (const terpene of terpenePatterns) {
    for (const pattern of terpene.patterns) {
      // Try multiple regex patterns for each terpene
      const regexPatterns = [
        // Pattern 1: Name followed directly by number with optional spacing
        new RegExp(`${pattern}[\\s:]*([0-9]+\\.?[0-9]*)\\s*%?`, 'gi'),
        // Pattern 2: Name in a table row with percentage
        new RegExp(`${pattern}[\\s\\|]+.*?([0-9]+\\.?[0-9]*)\\s*%`, 'gi'),
        // Pattern 3: Name with colon and percentage
        new RegExp(`${pattern}\\s*:\\s*([0-9]+\\.?[0-9]*)\\s*%?`, 'gi'),
        // Pattern 4: Percentage before name
        new RegExp(`([0-9]+\\.?[0-9]*)\\s*%?\\s*${pattern}`, 'gi')
      ]
      
      for (const regex of regexPatterns) {
        let match
        regex.lastIndex = 0 // Reset regex state
        
        while ((match = regex.exec(terpeneSection)) !== null) {
          const percentage = parseFloat(match[1])
          if (percentage > 0 && percentage < 10) { // Terpenes are typically 0.01-5%
            // Keep the highest value found for each terpene
            const currentValue = terpenes.get(terpene.name) || 0
            if (percentage > currentValue) {
              terpenes.set(terpene.name, percentage)
            }
            break // Found this terpene, move to next
          }
        }
      }
    }
  }
  
  // Convert map to array and sort by percentage
  const result = Array.from(terpenes.entries())
    .map(([name, percentage]) => ({ name, percentage }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5) // Return top 5 terpenes
  
  console.log('Terpenes extracted:', result)
  return result
}

// Helper: Extract specific cannabinoid values
function extractCannabinoidValue(text: string, cannabinoidType: string): number | undefined {
  const patterns = [
    new RegExp(`TOTAL\\s+${cannabinoidType}\\s*:?\\s*(\\d+\\.?\\d*)\\s*%`, 'i'),
    new RegExp(`${cannabinoidType}\\s+TOTAL\\s*:?\\s*(\\d+\\.?\\d*)\\s*%`, 'i'),
    new RegExp(`${cannabinoidType}\\s*:?\\s*(\\d+\\.?\\d*)\\s*%`, 'i')
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1])
      if (isValidCannabinoidValue(value, cannabinoidType)) {
        return value
      }
    }
  }

  return undefined
}

function isValidCannabinoidValue(value: number, type: string): boolean {
  if (!isFinite(value) || value < 0) return false
  
  switch (type.toUpperCase()) {
    case 'THC':
      return value >= 0 && value <= 50
    case 'CBD':
      return value >= 0 && value <= 30
    case 'TOTAL CANNABINOIDS':
      return value >= 0 && value <= 60
    default:
      return value >= 0 && value <= 100
  }
}

// Helper: Parse cannabinoids from structured sections
function parseStructuredCannabinoids(section: string): { thc?: number, cbd?: number, total?: number } {
  const result: { thc?: number, cbd?: number, total?: number } = {}
  
  const lines = section.split('\n')
  for (const line of lines) {
    if (/THC/i.test(line)) {
      const match = line.match(/(\d+\.?\d*)\s*%/)
      if (match) result.thc = parseFloat(match[1])
    }
    if (/CBD/i.test(line)) {
      const match = line.match(/(\d+\.?\d*)\s*%/)
      if (match) result.cbd = parseFloat(match[1])
    }
    if (/TOTAL.*CANNABINOID/i.test(line)) {
      const match = line.match(/(\d+\.?\d*)\s*%/)
      if (match) result.total = parseFloat(match[1])
    }
  }
  
  return result
}

// Helper: Find value in context window
function findValueInContext(text: string, keyword: string, windowSize = 100): number | undefined {
  const regex = new RegExp(keyword, 'gi')
  let match
  
  while ((match = regex.exec(text)) !== null) {
    const start = Math.max(0, match.index - windowSize)
    const end = Math.min(text.length, match.index + keyword.length + windowSize)
    const context = text.substring(start, end)
    
    const valueMatch = context.match(/(\d+\.?\d*)\s*%/)
    if (valueMatch) {
      const value = parseFloat(valueMatch[1])
      if (isValidCannabinoidValue(value, keyword)) {
        return value
      }
    }
  }
  
  return undefined
}

// Helper: Check if result has complete data
function hasCompleteData(result: ExtractedData): boolean {
  return !!(
    result.batchId &&
    result.strainName &&
    result.thcPercentage !== undefined &&
    result.cbdPercentage !== undefined &&
    result.totalCannabinoids !== undefined &&
    result.testDate &&
    result.terpenes && result.terpenes.length > 0
  )
}

// Helper: Determine if AI enhancement is needed
function shouldUseAIEnhancement(result: ExtractedData): boolean {
  // Use AI if we're missing critical data and confidence is low
  return (
    result.confidence < 70 ||
    (!result.thcPercentage && !result.cbdPercentage && !result.totalCannabinoids) ||
    !result.testDate ||
    (!result.terpenes || result.terpenes.length === 0)
  )
}

// AI enhancement
async function enhanceWithAI(text: string, baseResult: ExtractedData): Promise<ExtractedData> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    return { ...baseResult, extractionMethod: 'ai_enhancement_skipped' }
  }

  try {
    const prompt = `Extract cannabis COA data from this text. Return only JSON.

Expected format:
{
  "batchId": "string or null",
  "strainName": "string or null", 
  "thcPercentage": number or null,
  "cbdPercentage": number or null,
  "totalCannabinoids": number or null,
  "testDate": "string or null (format: MON DD, YYYY)",
  "terpenes": [{"name": "string", "percentage": number}]
}

Focus on finding:
- Batch IDs (like EVM####)
- Strain names from sample lines
- THC percentages (typically 15-35%)
- CBD percentages (typically 0.01-5%)
- Total cannabinoid percentages
- Test date or produced date (look for dates with months like JAN, FEB, etc)
- Top terpenes with percentages (Myrcene, Limonene, Caryophyllene, etc)

Text: ${text.substring(0, 3000)}`

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data: MistralExtractionResponse = await response.json()
    const content = data.choices[0].message.content
    const parsed = JSON.parse(content)

    return {
      ...baseResult,
      batchId: parsed.batchId || baseResult.batchId,
      strainName: parsed.strainName || baseResult.strainName,
      thcPercentage: parsed.thcPercentage || baseResult.thcPercentage,
      cbdPercentage: parsed.cbdPercentage !== null ? parsed.cbdPercentage : baseResult.cbdPercentage,
      totalCannabinoids: parsed.totalCannabinoids || baseResult.totalCannabinoids,
      testDate: parsed.testDate || baseResult.testDate,
      terpenes: parsed.terpenes || baseResult.terpenes,
      confidence: Math.min((baseResult.confidence || 0) + 15, 95),
      extractionMethod: 'ai_enhanced'
    }

  } catch (error) {
    console.error('AI enhancement failed:', error)
    return { ...baseResult, extractionMethod: 'ai_enhancement_failed' }
  }
}

// Intelligent result combination
function combineResults(results: ExtractedData[], labType: string): ExtractedData {
  if (results.length === 0) {
    return { confidence: 10, labName: "UNKNOWN LAB" }
  }

  // Start with highest confidence result
  const sorted = results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  const base = { ...sorted[0] }

  // Fill gaps from other results
  for (const result of sorted.slice(1)) {
    if (!base.batchId && result.batchId) base.batchId = result.batchId
    if (!base.strainName && result.strainName) base.strainName = result.strainName
    if (!base.thcPercentage && result.thcPercentage) base.thcPercentage = result.thcPercentage
    if (base.cbdPercentage === undefined && result.cbdPercentage !== undefined) base.cbdPercentage = result.cbdPercentage
    if (!base.totalCannabinoids && result.totalCannabinoids) base.totalCannabinoids = result.totalCannabinoids
    if (!base.testDate && result.testDate) base.testDate = result.testDate
    if ((!base.terpenes || base.terpenes.length === 0) && result.terpenes) base.terpenes = result.terpenes
  }

  // Calculate final confidence
  let finalConfidence = base.confidence || 10
  
  // Boost confidence for completeness
  if (base.batchId) finalConfidence += 5
  if (base.strainName) finalConfidence += 5
  if (base.thcPercentage) finalConfidence += 20
  if (base.cbdPercentage !== undefined) finalConfidence += 15
  if (base.totalCannabinoids) finalConfidence += 15
  if (base.testDate) finalConfidence += 10
  if (base.terpenes && base.terpenes.length > 0) finalConfidence += 10

  // Validation bonus
  if (base.thcPercentage && base.totalCannabinoids) {
    const diff = Math.abs(base.totalCannabinoids - base.thcPercentage)
    if (diff <= 2) finalConfidence += 10
  }

  base.confidence = Math.min(finalConfidence, 95)

  // Set lab-specific defaults
  if (labType === '2river') {
    base.labName = base.labName || "2 RIVER LABS, INC"
    base.category = base.category || "INHALABLE"
    base.subCategory = base.subCategory || "FLOWER"
  }

  base.extractionMethod = 'combined_strategies'
  
  return base
}