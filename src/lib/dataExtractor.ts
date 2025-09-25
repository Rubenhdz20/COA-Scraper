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

export async function extractDataFromOCRText(ocrText: string): Promise<ExtractedData> {
  try {
    console.log('Starting 2River Labs specialized extraction')
    console.log('OCR text length:', ocrText.length)

    // Clean OCR text for better parsing
    const cleanedText = cleanOCRText(ocrText)
    
    // DEBUG: Show cleaned OCR text sample
    console.log('=== CLEANED OCR TEXT SAMPLE ===')
    console.log(cleanedText.substring(0, 1000))
    console.log('=== END SAMPLE ===')

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set')
    }

    // Run pattern matching FIRST to find any values
    const patternResult = river2LabsPatternMatching(cleanedText)
    console.log('Pattern matching found cannabinoids:', {
      thc: patternResult.thcPercentage,
      cbd: patternResult.cbdPercentage,
      total: patternResult.totalCannabinoids
    })

    // 2River Labs specific extraction strategies with enhanced prompts
    const strategies = [
      { name: '2river-primary', prompt: create2RiverPrimaryPrompt(cleanedText, patternResult) },
      { name: '2river-fallback', prompt: create2RiverFallbackPrompt(cleanedText) },
      { name: 'pattern-matching', prompt: create2RiverPatternPrompt(cleanedText) }
    ]

    let bestResult: ExtractedData | null = null
    let highestConfidence = 0

    // Try AI strategies with the cleaned text
    for (const strategy of strategies) {
      try {
        console.log(`Trying 2River strategy: ${strategy.name}`)
        
        const result = await callMistralExtraction(strategy.prompt, apiKey)
        
        if (result && result.confidence > highestConfidence) {
          bestResult = { ...result, extractionMethod: strategy.name }
          highestConfidence = result.confidence
          console.log(`Strategy ${strategy.name} achieved confidence: ${result.confidence}`)
          console.log(`THC: ${result.thcPercentage}%, CBD: ${result.cbdPercentage}%, Total: ${result.totalCannabinoids}%`)
        }

        // If we get high confidence, use it
        if (result && result.confidence >= 85) {
          console.log(`High confidence result found with strategy: ${strategy.name}`)
          break
        }
      } catch (error) {
        console.error(`Strategy ${strategy.name} failed:`, error)
        continue
      }
    }

    // Merge best AI result with pattern matching result
    const finalResult = mergeBestResults(bestResult, patternResult)
    
    // Set lab name since we know it's 2River
    if (finalResult) {
      finalResult.labName = "2 RIVER LABS, INC"
      console.log('Final merged result:', {
        batchId: finalResult.batchId,
        strain: finalResult.strainName,
        thc: finalResult.thcPercentage,
        cbd: finalResult.cbdPercentage,
        total: finalResult.totalCannabinoids,
        confidence: finalResult.confidence
      })
    }

    return finalResult || { confidence: 10, labName: "2 RIVER LABS, INC" }

  } catch (error) {
    console.error('Error in 2River specialized extraction:', error)
    return { confidence: 10, labName: "2 RIVER LABS, INC" }
  }
}

// NEW: Clean OCR text to improve parsing accuracy
function cleanOCRText(text: string): string {
  return text
    // Fix common OCR number issues
    .replace(/\bO\b/g, '0')           // O -> 0
    .replace(/\bl\b/g, '1')           // l -> 1  
    .replace(/\bS\b/g, '5')           // S -> 5
    .replace(/\|\|/g, 'H')            // || -> H
    // Normalize whitespace around percentages
    .replace(/(\d+\.?\d*)\s*%/g, '$1%')
    // Fix common THC/CBD text issues
    .replace(/THC\s*:/gi, 'THC:')
    .replace(/CBD\s*:/gi, 'CBD:')
    .replace(/TOTAL\s+THC/gi, 'TOTAL THC')
    .replace(/TOTAL\s+CBD/gi, 'TOTAL CBD')
    .replace(/TOTAL\s+CANNABINOIDS/gi, 'TOTAL CANNABINOIDS')
    // Normalize spacing
    .replace(/\s+/g, ' ')
    .trim()
}

// NEW: Merge the best results from AI and pattern matching
function mergeBestResults(aiResult: ExtractedData | null, patternResult: ExtractedData): ExtractedData {
  const merged = { ...patternResult }
  
  if (aiResult) {
    // Use AI result for fields where pattern matching failed
    if (!merged.batchId && aiResult.batchId) merged.batchId = aiResult.batchId
    if (!merged.strainName && aiResult.strainName) merged.strainName = aiResult.strainName
    if (!merged.thcPercentage && aiResult.thcPercentage) merged.thcPercentage = aiResult.thcPercentage
    if (!merged.cbdPercentage && aiResult.cbdPercentage) merged.cbdPercentage = aiResult.cbdPercentage
    if (!merged.totalCannabinoids && aiResult.totalCannabinoids) merged.totalCannabinoids = aiResult.totalCannabinoids
    if (!merged.testDate && aiResult.testDate) merged.testDate = aiResult.testDate
    if (!merged.terpenes && aiResult.terpenes) merged.terpenes = aiResult.terpenes
    
    // Use higher confidence
    if (aiResult.confidence > merged.confidence) {
      merged.confidence = aiResult.confidence
      merged.extractionMethod = aiResult.extractionMethod
    }
  }
  
  return merged
}

// ENHANCED: Primary prompt with pattern matching hints
function create2RiverPrimaryPrompt(ocrText: string, patternHints: ExtractedData): string {
  const hintsText = `
Pattern matching found these hints:
- Batch ID: ${patternHints.batchId || 'not found'}
- Strain: ${patternHints.strainName || 'not found'}  
- THC%: ${patternHints.thcPercentage || 'not found'}
- CBD%: ${patternHints.cbdPercentage || 'not found'}
- Total Cannabinoids%: ${patternHints.totalCannabinoids || 'not found'}

`

  return `${hintsText}

You are extracting data from a 2 RIVER LABS COA document. Focus on finding CANNABINOID PERCENTAGES.

CRITICAL: Look for these EXACT patterns in the text:
- "TOTAL THC" followed by a percentage (like "24.2%" or "24.20%")
- "TOTAL CBD" followed by a percentage (like "0.04%" or "0.0448%")  
- "TOTAL CANNABINOIDS" followed by a percentage (like "24.3%")

The percentages might appear as:
- "TOTAL THC: 24.2%"
- "TOTAL THC 24.2%"
- "TOTAL THC    24.2 %"
- Numbers might have OCR errors like "24.Z%" (should be 24.2%)

OTHER FIELDS:
1. BATCH ID: Format "EVM####" (like EVM0579, EVM0578)
2. STRAIN NAME: Look for strain in "SAMPLE:" line
3. CATEGORY: Always "INHALABLE" for flower
4. SUB-CATEGORY: Always "FLOWER" for flower products

Return ONLY valid JSON with actual numbers (not null):
{
  "batchId": "EVM#### or null",
  "strainName": "STRAIN NAME or null",
  "category": "INHALABLE",
  "subCategory": "FLOWER", 
  "thcPercentage": number_value_only_no_quotes,
  "cbdPercentage": number_value_only_no_quotes,
  "totalCannabinoids": number_value_only_no_quotes,
  "testDate": "YYYY-MM-DD or null"
}

OCR Text:
${ocrText}`
}

// ENHANCED: Fallback prompt with more aggressive search
function create2RiverFallbackPrompt(ocrText: string): string {
  return `This is a 2 RIVER LABS cannabis COA. The OCR might have errors.

FIND THESE NUMBERS AT ALL COSTS:
1. Any percentage near "THC" (Total THC value)
2. Any percentage near "CBD" (Total CBD value) 
3. Any percentage near "CANNABINOIDS" (Total cannabinoids)

Look for variations like:
- "THC: 24.2%" or "THC 24.2%" or "THC    24.2%"
- Numbers might be corrupted: "Z4.2%" = "24.2%", "O.04%" = "0.04%"
- Decimal points might be missing: "242%" = "24.2%"

Search the ENTIRE text for any number followed by % that could be cannabinoid values.
THC is typically 10-30%, CBD is typically 0-5%, Total is typically 15-35%.

Return ONLY JSON with actual numbers found:
{
  "batchId": "EVM#### or null",
  "strainName": "strain name or null", 
  "thcPercentage": actual_number_found,
  "cbdPercentage": actual_number_found,
  "totalCannabinoids": actual_number_found
}

Text to analyze: ${ocrText.substring(0, 3000)}`
}

// ENHANCED: Pattern prompt with more context
function create2RiverPatternPrompt(ocrText: string): string {
  // Show more pattern examples
  const batchMatch = ocrText.match(/EVM\d{4}/gi)
  const allPercentages = ocrText.match(/\d+\.?\d*\s*%/g) || []
  
  return `2River Labs COA Analysis:

Found patterns:
- Batch IDs: ${batchMatch ? batchMatch.join(', ') : 'none found'}
- All percentages in document: ${allPercentages.slice(0, 10).join(', ')}

Your job: Match percentages to cannabinoid types.
Look for context words near percentages:
- "THC", "TETRAHYDROCANNABINOL" near a percentage = THC value
- "CBD", "CANNABIDIOL" near a percentage = CBD value  
- "TOTAL", "CANNABINOIDS" near a percentage = Total cannabinoids

Return JSON with the numbers you can confidently identify:
{
  "thcPercentage": number_or_null,
  "cbdPercentage": number_or_null,
  "totalCannabinoids": number_or_null,
  "batchId": "EVM#### or null"
}

Text: ${ocrText.substring(0, 2000)}`
}

async function callMistralExtraction(prompt: string, apiKey: string): Promise<ExtractedData | null> {
  try {
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
        temperature: 0.01, // Even lower temperature for precision
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error('Mistral API response not OK:', response.status)
      throw new Error(`Mistral API error: ${response.status}`)
    }

    const data: MistralExtractionResponse = await response.json()
    const extractionResult = data.choices[0].message.content
    
    console.log('Raw Mistral response:', extractionResult)

    const parsedData = JSON.parse(extractionResult)
    const confidence = calculate2RiverConfidence(parsedData)

    return { ...parsedData, confidence }

  } catch (error) {
    console.error('Mistral extraction call failed:', error)
    return null
  }
}

// ENHANCED: More comprehensive pattern matching with better regex
function river2LabsPatternMatching(ocrText: string): ExtractedData {
  console.log('Running ENHANCED 2River Labs pattern matching')
  
  const result: ExtractedData = { 
    confidence: 70,
    labName: "2 RIVER LABS, INC",
    category: "INHALABLE"
  }

  // 1. BATCH ID - More flexible EVM pattern
  const batchPatterns = [
    /BATCH\s*ID\s*:?\s*(EVM\d{4})/i,
    /BATCH\s*:?\s*(EVM\d{4})/i,
    /(EVM\d{4})/gi
  ]

  for (const pattern of batchPatterns) {
    const match = ocrText.match(pattern)
    if (match) {
      result.batchId = (match[1] || match[0]).toUpperCase()
      result.confidence += 15
      console.log(`Found batch ID: ${result.batchId}`)
      break
    }
  }

  // 2. STRAIN NAME - More flexible patterns
  const strainPatterns = [
    /SAMPLE\s*:?\s*([A-Z][A-Z\s&-]+?)\s*\(?FLOWER/i,
    /SAMPLE\s*:?\s*([A-Z][A-Z\s&-]+?)\s*\(?INHALABLE/i,
    /CLIENT\s*:?\s*[^\n]+\s*([A-Z][A-Z\s&-]{5,})/i
  ]

  for (const pattern of strainPatterns) {
    const match = ocrText.match(pattern)
    if (match && match[1].trim().length > 3) {
      result.strainName = match[1].trim().replace(/\s+/g, ' ')
      result.confidence += 10
      console.log(`Found strain: ${result.strainName}`)
      break
    }
  }

  // 3. MATRIX/SUB-CATEGORY
  if (/MATRIX.*FLOWER|FLOWER.*MATRIX/i.test(ocrText)) {
    result.subCategory = 'FLOWER'
    result.confidence += 5
  }

  // 4. ENHANCED CANNABINOID DETECTION with multiple fallback patterns
  
  // THC DETECTION - Much more comprehensive
  const thcPatterns = [
    // Standard formats
    /TOTAL\s+THC\s*:?\s*(\d+\.?\d*)\s*%/gi,
    // Without "TOTAL"
    /(?:^|\s)THC\s*:?\s*(\d+\.?\d*)\s*%/gim,
    // With extra spacing
    /TOTAL\s+T\s*H\s*C\s*:?\s*(\d+\.?\d*)\s*%/gi,
    // Alternative wordings
    /(?:TOTAL\s+)?TETRAHYDROCANNABINOL\s*:?\s*(\d+\.?\d*)\s*%/gi,
    // OCR corruption patterns
    /TOTAL\s+THC\s*[:\-]?\s*(\d+)[.,](\d+)\s*%/gi,
    // Loose pattern - any percentage near THC
    /THC[^\d]*(\d+\.?\d*)\s*%/gi
  ]

  for (const pattern of thcPatterns) {
    const matches = [...ocrText.matchAll(pattern)]
    for (const match of matches) {
      let value: number
      
      // Handle decimal reconstruction from OCR errors
      if (match[2]) {
        value = parseFloat(`${match[1]}.${match[2]}`)
      } else {
        value = parseFloat(match[1])
      }
      
      // Validate THC range (should be 5-50% for most flower)
      if (value >= 0.1 && value <= 50) {
        result.thcPercentage = value
        result.confidence += 30 // High reward for finding THC
        console.log(`Found THC: ${value}% using pattern: ${pattern.source}`)
        break
      }
    }
    if (result.thcPercentage) break
  }

  // CBD DETECTION - More comprehensive  
  const cbdPatterns = [
    /TOTAL\s+CBD\s*:?\s*(\d+\.?\d*)\s*%/gi,
    /(?:^|\s)CBD\s*:?\s*(\d+\.?\d*)\s*%/gim,
    /TOTAL\s+C\s*B\s*D\s*:?\s*(\d+\.?\d*)\s*%/gi,
    /(?:TOTAL\s+)?CANNABIDIOL\s*:?\s*(\d+\.?\d*)\s*%/gi,
    // Handle very small CBD values with more decimals
    /TOTAL\s+CBD\s*:?\s*(\d+)\.(\d{1,4})\s*%/gi,
    /CBD[^\d]*(\d+\.?\d*)\s*%/gi
  ]

  for (const pattern of cbdPatterns) {
    const matches = [...ocrText.matchAll(pattern)]
    for (const match of matches) {
      let value: number
      
      if (match[2]) {
        value = parseFloat(`${match[1]}.${match[2]}`)
      } else {
        value = parseFloat(match[1])
      }
      
      // CBD can be very low (0.0001%) or higher (up to 25%)
      if (value >= 0 && value <= 30) {
        result.cbdPercentage = value
        result.confidence += 25
        console.log(`Found CBD: ${value}% using pattern: ${pattern.source}`)
        break
      }
    }
    if (result.cbdPercentage !== undefined) break
  }

  // TOTAL CANNABINOIDS - Enhanced detection
  const totalCannPatterns = [
    /TOTAL\s+CANNABINOIDS\s*:?\s*(\d+\.?\d*)\s*%/gi,
    /TOTAL\s+CANN[AI]BINOIDS\s*:?\s*(\d+\.?\d*)\s*%/gi, // OCR might read A as I
    /CANNABINOIDS\s+TOTAL\s*:?\s*(\d+\.?\d*)\s*%/gi,
    /TOTAL\s+C\s*A\s*N\s*N\s*A\s*B\s*I\s*N\s*O\s*I\s*D\s*S\s*:?\s*(\d+\.?\d*)\s*%/gi,
    // Fallback - look for "TOTAL" near a reasonable percentage
    /TOTAL[^\d]*(\d+\.?\d*)\s*%/gi
  ]

  for (const pattern of totalCannPatterns) {
    const matches = [...ocrText.matchAll(pattern)]
    for (const match of matches) {
      const value = parseFloat(match[1])
      
      // Total cannabinoids should be reasonable (5-60%)
      if (value >= 1 && value <= 60) {
        // Additional validation: if we have THC, total should be >= THC
        if (!result.thcPercentage || value >= result.thcPercentage) {
          result.totalCannabinoids = value
          result.confidence += 25
          console.log(`Found Total Cannabinoids: ${value}% using pattern: ${pattern.source}`)
          break
        }
      }
    }
    if (result.totalCannabinoids) break
  }

  // Cross-validation: if total < THC, there might be an error
  if (result.thcPercentage && result.totalCannabinoids && result.totalCannabinoids < result.thcPercentage) {
    console.log('Warning: Total cannabinoids < THC, possible extraction error')
    result.confidence -= 10
  }

  // Enhanced terpene detection (keeping original logic but with better patterns)
  const terpenes: Array<{ name: string; percentage: number }> = []
  
  const terpenePatterns = [
    /([βα]?\s*-?\s*[A-Z]+[A-Z\s-]*?ENE)\s+(\d+\.?\d*)\s*%/gi,
    /(LIMONENE|LINALOOL|MYRCENE|CARYOPHYLLENE|PINENE|HUMULENE|TERPINOLENE)\s+(\d+\.?\d*)\s*%/gi
  ]

  for (const pattern of terpenePatterns) {
    const matches = [...ocrText.matchAll(pattern)]
    for (const match of matches) {
      const name = match[1].trim()
      const percentage = parseFloat(match[2])
      if (percentage > 0 && percentage < 10 && !terpenes.find(t => t.name === name)) {
        terpenes.push({ name, percentage })
      }
    }
  }

  if (terpenes.length > 0) {
    terpenes.sort((a, b) => b.percentage - a.percentage)
    result.terpenes = terpenes.slice(0, 3)
    result.confidence += 10
  }

  // Enhanced date detection
  const datePatterns = [
    /(\w{3}\s+\d{1,2},?\s+\d{4})/g,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    /(\d{4}-\d{1,2}-\d{1,2})/g
  ]

  for (const pattern of datePatterns) {
    const match = ocrText.match(pattern)
    if (match) {
      try {
        const date = new Date(match[1])
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

  // Final confidence boost if we found key cannabinoid data
  const cannabinoidDataFound = !!(result.thcPercentage || result.cbdPercentage || result.totalCannabinoids)
  if (cannabinoidDataFound) {
    result.confidence += 15
    console.log('Bonus confidence for finding cannabinoid data')
  }

  console.log('Enhanced 2River pattern matching final result:', {
    confidence: result.confidence,
    batchId: result.batchId,
    strain: result.strainName,
    thc: result.thcPercentage,
    cbd: result.cbdPercentage,
    total: result.totalCannabinoids
  })
  
  return result
}

// ENHANCED: Better confidence calculation
function calculate2RiverConfidence(data: any): number {
  let confidence = 30 // Lower base confidence

  // CRITICAL cannabinoid fields (higher weights)
  if (data.thcPercentage && data.thcPercentage > 0 && data.thcPercentage < 50) confidence += 35
  if (data.cbdPercentage !== undefined && data.cbdPercentage >= 0 && data.cbdPercentage < 30) confidence += 25
  if (data.totalCannabinoids && data.totalCannabinoids > 0 && data.totalCannabinoids <= 60) confidence += 30

  // Standard 2River fields
  if (data.batchId && data.batchId.match(/EVM\d{4}/i)) confidence += 15
  if (data.strainName && data.strainName.length > 2) confidence += 8
  if (data.category === 'INHALABLE') confidence += 3
  if (data.subCategory === 'FLOWER') confidence += 3
  if (data.terpenes && data.terpenes.length > 0) confidence += 8

  // Validation bonuses
  if (data.thcPercentage && data.totalCannabinoids) {
    const diff = Math.abs(data.totalCannabinoids - data.thcPercentage)
    if (diff >= 0 && diff < 10) confidence += 8 // Reasonable difference
  }

  return Math.min(confidence, 95) // Cap at 95%
}