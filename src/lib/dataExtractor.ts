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

export async function extractDataFromOCRText(ocrText: string): Promise<ExtractedData> {
  try {
    console.log('Starting refined 2River Labs extraction')
    console.log('Text length:', ocrText.length)

    // Clean text for better matching
    const cleanText = cleanOCRText(ocrText)
    
    // Execute refined 2River extraction
    const result = refined2RiverExtraction(cleanText)
    
    // Fill any gaps with fallback strategies
    const enhancedResult = await enhanceWithFallbacks(cleanText, result)
    
    console.log('Final extraction result:', {
      batchId: enhancedResult.batchId,
      strain: enhancedResult.strainName,
      thc: enhancedResult.thcPercentage,
      cbd: enhancedResult.cbdPercentage,
      total: enhancedResult.totalCannabinoids,
      testDate: enhancedResult.testDate,
      terpenes: enhancedResult.terpenes?.length || 0,
      confidence: enhancedResult.confidence
    })

    return enhancedResult

  } catch (error) {
    console.error('Extraction failed:', error)
    return { confidence: 10, labName: "2 RIVER LABS, INC" }
  }
}

function cleanOCRText(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/(\d+\.?\d*)\s*%/g, '$1%')  // Fix percentage spacing
    .replace(/BATCH\s+ID\s*:/gi, 'BATCH ID:')  // Normalize batch ID format
    .replace(/TOTAL\s+THC/gi, 'TOTAL THC')  // Normalize THC format
    .replace(/TOTAL\s+CBD/gi, 'TOTAL CBD')  // Normalize CBD format
    .trim()
}

function refined2RiverExtraction(text: string): ExtractedData {
  console.log('Running refined 2River extraction...')
  
  const result: ExtractedData = {
    confidence: 50,
    labName: "2 RIVER LABS, INC",
    category: "INHALABLE",
    subCategory: "FLOWER",
    extractionMethod: "refined_2river"
  }

  // 1. Extract Batch ID - Multiple patterns for 2River formats
  console.log('Extracting batch ID...')
  const batchPatterns = [
    /BATCH ID:\s*(EV\d{4})/i,           // "BATCH ID: EV0628"
    /BATCH ID:\s*(EVM\d{4})/i,          // "BATCH ID: EVM0578" 
    /BATCH\s*ID\s*:\s*(EV\d{4})/i,      // With spacing variations
    /BATCH\s*ID\s*:\s*(EVM\d{4})/i,     // With spacing variations
    /(EV\d{4})/g,                       // Fallback: just EV#### pattern
    /(EVM\d{4})/g                       // Fallback: just EVM#### pattern
  ]

  for (const pattern of batchPatterns) {
    const match = text.match(pattern)
    if (match) {
      result.batchId = match[1]
      result.confidence += 15
      console.log(`Found batch ID: ${result.batchId}`)
      break
    }
  }

  // 2. Extract Strain Name from SAMPLE line
  console.log('Extracting strain name...')
  const strainPatterns = [
    /SAMPLE:\s*([A-Z][A-Z\s&\-'()]+?)\s*\(FLOWER\)/i,
    /SAMPLE:\s*([A-Z][A-Z\s&\-'()]+?)\s*\/\/\s*CLIENT/i
  ]

  for (const pattern of strainPatterns) {
    const match = text.match(pattern)
    if (match) {
      result.strainName = match[1].trim()
      result.confidence += 10
      console.log(`Found strain: ${result.strainName}`)
      break
    }
  }

  // 3. Extract THC from TOTAL THC line in table
  console.log('Extracting THC...')
  const thcPatterns = [
    /TOTAL THC\s*\|\s*\|\s*(\d+\.?\d*%)/i,           // "TOTAL THC | | 26.8%"
    /TOTAL THC\s*\|\s*(\d+\.?\d*%)/i,                // "TOTAL THC | 26.8%"  
    /TOTAL THC[\s\|]*(\d+\.?\d*)%/i,                 // More flexible
    /TOTAL THC[^0-9]*(\d+\.?\d*)%/i                  // Very flexible
  ]

  for (const pattern of thcPatterns) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1])
      if (value > 0 && value <= 50) {
        result.thcPercentage = value
        result.confidence += 25
        console.log(`Found THC: ${result.thcPercentage}%`)
        break
      }
    }
  }

  // 4. Extract CBD from TOTAL CBD line in table
  console.log('Extracting CBD...')
  const cbdPatterns = [
    /TOTAL CBD\s*\|\s*\|\s*(\d+\.?\d*%)/i,           // "TOTAL CBD | | 0.0546%"
    /TOTAL CBD\s*\|\s*(\d+\.?\d*%)/i,                // "TOTAL CBD | 0.0546%"
    /TOTAL CBD[\s\|]*(\d+\.?\d*)%/i,                 // More flexible
    /TOTAL CBD[^0-9]*(\d+\.?\d*)%/i                  // Very flexible
  ]

  for (const pattern of cbdPatterns) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1])
      if (value >= 0 && value <= 30) {
        result.cbdPercentage = value
        result.confidence += 20
        console.log(`Found CBD: ${result.cbdPercentage}%`)
        break
      }
    }
  }

  // 5. Calculate or extract Total Cannabinoids
  console.log('Determining total cannabinoids...')
  if (result.thcPercentage && result.cbdPercentage) {
    // Calculate total from THC + CBD + small buffer for other cannabinoids
    result.totalCannabinoids = Math.round((result.thcPercentage + result.cbdPercentage) * 10) / 10
    result.confidence += 10
    console.log(`Calculated total cannabinoids: ${result.totalCannabinoids}%`)
  } else if (result.thcPercentage) {
    // Use THC as approximation if CBD is very low
    result.totalCannabinoids = result.thcPercentage
    result.confidence += 5
    console.log(`Using THC as total cannabinoids: ${result.totalCannabinoids}%`)
  }

  // 6. Extract Test Date
  console.log('Extracting test date...')
  const datePatterns = [
    /PRODUCED:\s*([A-Z]{3}\s+\d{1,2},?\s+\d{4})/i,   // "PRODUCED: NOV 19, 2023"
    /(\w{3}\s+\d{1,2},?\s+\d{4})/g                    // General date pattern
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      try {
        const dateStr = match[1] || match[0]
        const date = new Date(dateStr)
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2020) {
          result.testDate = date.toISOString().split('T')[0]
          result.confidence += 5
          console.log(`Found test date: ${result.testDate}`)
          break
        }
      } catch (e) {
        continue
      }
    }
  }

  // 7. Extract Top 3 Terpenes from terpene table
  console.log('Extracting terpenes...')
  result.terpenes = extractTerpeneData(text)
  if (result.terpenes.length > 0) {
    result.confidence += 10
    console.log(`Found ${result.terpenes.length} terpenes:`, result.terpenes.map(t => `${t.name}: ${t.percentage}%`))
  }

  return result
}

function extractTerpeneData(text: string): Array<{ name: string; percentage: number }> {
  const terpenes: Array<{ name: string; percentage: number }> = []
  
  // Look for terpene section in the text
  const terpeneSection = text.match(/M-0255:\s*TERPENES[\s\S]*?(?=M-\d+:|$)/i)
  const searchText = terpeneSection ? terpeneSection[0] : text
  
  console.log('Searching for terpenes in section length:', searchText.length)
  
  // Patterns for 2River terpene format: "TERPENE_NAME | percentage% | mg/g amount"
  const terpenePatterns = [
    // Standard format: "β-MYRCENE | 1.63% | 16.3 mg/g"
    /([βα]?-?[A-Z][A-Z-]+(?:ENE|OOL|INE|ANOL))\s*\|\s*(\d+\.?\d*%)/gi,
    // Alternative format variations
    /([A-Z][A-Z-]+(?:ENE|OOL|INE|ANOL))\s*\|\s*(\d+\.?\d*%)/gi,
    // Common terpenes by name
    /(LIMONENE|MYRCENE|CARYOPHYLLENE|LINALOOL|PINENE|HUMULENE|BISABOLOL|TERPINOLENE|NEROLIDOL)\s*\|\s*(\d+\.?\d*%)/gi
  ]

  for (const pattern of terpenePatterns) {
    let match
    while ((match = pattern.exec(searchText)) !== null) {
      const name = match[1].trim()
      const percentageStr = match[2].replace('%', '')
      const percentage = parseFloat(percentageStr)
      
      // Validate terpene data
      if (percentage > 0 && percentage < 10 && !terpenes.find(t => t.name === name)) {
        terpenes.push({ name, percentage })
        console.log(`Found terpene: ${name} -> ${percentage}%`)
      }
    }
  }
  
  // Sort by percentage (highest first) and return top 3
  return terpenes
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3)
}

async function enhanceWithFallbacks(text: string, baseResult: ExtractedData): Promise<ExtractedData> {
  const result = { ...baseResult }
  
  // Fallback for missing batch ID
  if (!result.batchId) {
    console.log('Applying batch ID fallbacks...')
    // Look for any EV or EVM pattern in the text
    const fallbackBatch = text.match(/(EVM?\d{4})/i)
    if (fallbackBatch) {
      result.batchId = fallbackBatch[1]
      result.confidence += 10
      console.log(`Fallback batch ID found: ${result.batchId}`)
    }
  }

  // Fallback for missing cannabinoids - use table scanning
  if (!result.thcPercentage || !result.cbdPercentage) {
    console.log('Applying cannabinoid fallbacks...')
    const tableResults = scanPotencyTable(text)
    
    if (!result.thcPercentage && tableResults.thc) {
      result.thcPercentage = tableResults.thc
      result.confidence += 15
      console.log(`Fallback THC found: ${result.thcPercentage}%`)
    }
    
    if (!result.cbdPercentage && tableResults.cbd !== undefined) {
      result.cbdPercentage = tableResults.cbd
      result.confidence += 15
      console.log(`Fallback CBD found: ${result.cbdPercentage}%`)
    }
  }

  // Fallback for missing test date
  if (!result.testDate) {
    console.log('Applying test date fallbacks...')
    // Look for any date in the document
    const dateMatch = text.match(/(NOV|DEC|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT)\s+\d{1,2},?\s+\d{4}/i)
    if (dateMatch) {
      try {
        const date = new Date(dateMatch[0])
        if (!isNaN(date.getTime())) {
          result.testDate = date.toISOString().split('T')[0]
          result.confidence += 5
          console.log(`Fallback test date found: ${result.testDate}`)
        }
      } catch (e) {
        // Continue without date
      }
    }
  }

  // Final confidence calculation
  let finalConfidence = result.confidence || 10
  
  // Bonus for completeness
  if (result.batchId) finalConfidence += 5
  if (result.strainName) finalConfidence += 5
  if (result.thcPercentage) finalConfidence += 15
  if (result.cbdPercentage !== undefined) finalConfidence += 10
  if (result.totalCannabinoids) finalConfidence += 10
  if (result.testDate) finalConfidence += 5
  if (result.terpenes && result.terpenes.length > 0) finalConfidence += 10

  result.confidence = Math.min(finalConfidence, 95)

  return result
}

function scanPotencyTable(text: string): { thc?: number, cbd?: number } {
  const result: { thc?: number, cbd?: number } = {}
  
  // Find the potency section
  const potencySection = text.match(/M-024:\s*POTENCY[\s\S]*?(?=M-\d+:|$)/i)
  const searchText = potencySection ? potencySection[0] : text
  
  console.log('Scanning potency table, section length:', searchText.length)
  
  // Look for table rows with cannabinoid data
  const lines = searchText.split('\n')
  
  for (const line of lines) {
    // THC line: look for percentage values in THC context
    if (/TOTAL THC/i.test(line)) {
      const match = line.match(/(\d+\.?\d*)%/)
      if (match) {
        const value = parseFloat(match[1])
        if (value > 0 && value <= 50) {
          result.thc = value
          console.log(`Table scan found THC: ${value}%`)
        }
      }
    }
    
    // CBD line: look for percentage values in CBD context
    if (/TOTAL CBD/i.test(line)) {
      const match = line.match(/(\d+\.?\d*)%/)
      if (match) {
        const value = parseFloat(match[1])
        if (value >= 0 && value <= 30) {
          result.cbd = value
          console.log(`Table scan found CBD: ${value}%`)
        }
      }
    }
  }
  
  return result
}