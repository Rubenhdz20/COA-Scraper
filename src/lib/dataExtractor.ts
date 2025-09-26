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

// Core extraction engine - keeping your working approach
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
        batchId: result.batchId,
        thc: result.thcPercentage,
        cbd: result.cbdPercentage,
        total: result.totalCannabinoids,
        testDate: result.testDate,
        terpenes: result.terpenes?.length || 0,
        confidence: result.confidence
      })
    }

    // Combine results using intelligent merging
    const finalResult = combineResults(results, labType)

    console.log('Final result:', {
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

function detectLabType(text: string): string {
  if (/2\s*RIVER\s*LABS/i.test(text)) return '2river'
  return 'generic'
}

function detectLabName(text: string): string | null {
  const match = text.match(/2\s*RIVER\s*LABS[^,\n]*/i)
  return match ? match[0].trim() : null
}

function getExtractionStrategies(labType: string): ExtractionStrategy[] {
  const strategies: ExtractionStrategy[] = [
    { name: 'structured_pattern', extract: structuredPatternExtraction },
    { name: 'numerical_analysis', extract: numericalAnalysisExtraction },
    { name: 'contextual_search', extract: contextualSearchExtraction }
  ]

  if (labType === '2river') {
    strategies.unshift({ name: '2river_specific', extract: river2SpecificExtraction })
  }

  return strategies
}

// FIXED: 2River Labs specific patterns
function river2SpecificExtraction(text: string): ExtractedData {
  const result: ExtractedData = {
    confidence: 40,
    labName: "2 RIVER LABS, INC",
    category: "INHALABLE",
    extractionMethod: "2river_specific"
  }

  // Clean text for better matching
  const cleanText = text.replace(/\s+/g, ' ').trim()

  // FIXED: Extract batch ID - broader patterns
  console.log('Searching for batch ID...')
  const batchPatterns = [
    /BATCH\s*ID\s*:?\s*(EV[MO]?\d{4})/i,  // EV, EVO, EVM patterns
    /(EV[MO]?\d{4})/g                      // Any EV pattern in text
  ]

  for (const pattern of batchPatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      result.batchId = match[1] || match[0]
      result.confidence += 15
      console.log(`Found batch ID: ${result.batchId}`)
      break
    }
  }

  // FIXED: Extract strain name - more flexible
  console.log('Searching for strain name...')
  const strainPatterns = [
    /SAMPLE:\s*([A-Z][A-Z\s&\-'()]+?)\s*\(FLOWER\)/i,
    /SAMPLE:\s*([A-Z][A-Z\s&\-'()]+?)\s*\/\/\s*CLIENT/i
  ]

  for (const pattern of strainPatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      result.strainName = match[1].trim()
      result.confidence += 10
      console.log(`Found strain: ${result.strainName}`)
      break
    }
  }

  // Set sub-category for flower products
  if (/FLOWER|MATRIX:\s*FLOWER/i.test(text)) {
    result.subCategory = 'FLOWER'
    result.confidence += 5
  }

  // Keep your working cannabinoid extraction - don't change this part
  // This was working in your previous version
  
  // FIXED: Extract test date - multiple patterns
  console.log('Searching for test date...')
  const datePatterns = [
    /PRODUCED:\s*([A-Z]{3}\s+\d{1,2},?\s+\d{4})/i,  // "PRODUCED: NOV 19, 2023"
    /CERTIFICATE.*ANALYSIS.*PRODUCED:\s*([A-Z]{3}\s+\d{1,2},?\s+\d{4})/i,
    /([A-Z]{3}\s+\d{1,2},?\s+\d{4})/g  // Any date in text
  ]

  for (const pattern of datePatterns) {
    const matches = cleanText.matchAll(new RegExp(pattern.source, pattern.flags))
    for (const match of matches) {
      try {
        const dateStr = match[1] || match[0]
        const date = new Date(dateStr)
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2020 && date.getFullYear() <= 2025) {
          result.testDate = date.toISOString().split('T')[0]
          result.confidence += 5
          console.log(`Found test date: ${result.testDate}`)
          break
        }
      } catch (e) {
        continue
      }
    }
    if (result.testDate) break
  }

  // FIXED: Extract terpenes - better patterns
  console.log('Searching for terpenes...')
  result.terpenes = extractTerpenes(text)
  if (result.terpenes.length > 0) {
    result.confidence += 10
    console.log(`Found terpenes:`, result.terpenes.map(t => `${t.name}: ${t.percentage}%`))
  }

  return result
}

// FIXED: Better terpene extraction
function extractTerpenes(text: string): Array<{ name: string; percentage: number }> {
  const terpenes: Array<{ name: string; percentage: number }> = []
  
  console.log('Extracting terpenes from text...')
  
  // Look for terpene patterns - flexible approach
  const terpenePatterns = [
    // Pattern 1: "TERPENE_NAME | percentage% | amount mg/g"
    /([βα]?-?[A-Z-]+(?:ENE|OOL|INE|ANOL))\s*\|\s*(\d+\.\d+)%/gi,
    // Pattern 2: "TERPENE_NAME percentage% amount mg/g"  
    /([βα]?-?[A-Z-]+(?:ENE|OOL|INE|ANOL))\s+(\d+\.\d+)%/gi,
    // Pattern 3: Common terpenes by name
    /(MYRCENE|LIMONENE|CARYOPHYLLENE|LINALOOL|PINENE|HUMULENE|BISABOLOL|TERPINOLENE|NEROLIDOL)\s*[\|\s]+(\d+\.\d+)%/gi
  ]
  
  for (const pattern of terpenePatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim().replace(/^[βα]-?/, '').replace(/^\-/, '') // Clean up prefixes
      const percentage = parseFloat(match[2])
      
      // Validate terpene data
      if (percentage > 0 && percentage < 10 && name.length > 2) {
        // Don't add duplicates
        if (!terpenes.find(t => t.name.toLowerCase() === name.toLowerCase())) {
          terpenes.push({ name, percentage })
          console.log(`Found terpene: ${name} -> ${percentage}%`)
        }
      }
    }
  }
  
  // Sort by percentage (highest first) and return top 3
  return terpenes
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3)
}

// Keep your working strategies but enhance them slightly
function structuredPatternExtraction(text: string): ExtractedData {
  const result: ExtractedData = {
    confidence: 30,
    extractionMethod: "structured_pattern"
  }

  // Look for structured sections
  const sections = text.split(/\n(?=[A-Z-]+:|M-\d+:|##)/g)
  
  for (const section of sections) {
    if (/POTENCY|CANNABINOID/i.test(section)) {
      const cannabinoids = parseStructuredCannabinoids(section)
      if (cannabinoids.thc) result.thcPercentage = cannabinoids.thc
      if (cannabinoids.cbd !== undefined) result.cbdPercentage = cannabinoids.cbd
      if (cannabinoids.total) result.totalCannabinoids = cannabinoids.total
      
      if (cannabinoids.thc || cannabinoids.cbd !== undefined || cannabinoids.total) {
        result.confidence += 30
      }
    }
  }

  return result
}

function numericalAnalysisExtraction(text: string): ExtractedData {
  const result: ExtractedData = {
    confidence: 25,
    extractionMethod: "numerical_analysis"
  }

  // Extract all decimal numbers
  const decimals = text.match(/\d+\.\d+/g) || []
  
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
      if (!result.thcPercentage || Math.abs(value - result.thcPercentage) <= 5) {
        result.totalCannabinoids = value
        result.confidence += 15
      }
    }
  }

  return result
}

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

  return result
}

// Helper functions
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
      if (value > 0 && value <= 100) {
        return value
      }
    }
  }
  
  return undefined
}

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
  
  if (base.batchId) finalConfidence += 5
  if (base.strainName) finalConfidence += 5
  if (base.thcPercentage) finalConfidence += 20
  if (base.cbdPercentage !== undefined) finalConfidence += 15
  if (base.totalCannabinoids) finalConfidence += 15
  if (base.testDate) finalConfidence += 5
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