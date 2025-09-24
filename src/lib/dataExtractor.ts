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
    console.log('Starting enhanced AI data extraction from OCR text')
    console.log('OCR text length:', ocrText.length)

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set')
    }

    // Try multiple extraction strategies
    const strategies = [
      { name: 'comprehensive', prompt: createComprehensivePrompt(ocrText) },
      { name: 'table-focused', prompt: createTableFocusedPrompt(ocrText) },
      { name: 'regex-guided', prompt: createRegexGuidedPrompt(ocrText) }
    ]

    let bestResult: ExtractedData | null = null
    let highestConfidence = 0

    for (const strategy of strategies) {
      try {
        console.log(`Trying extraction strategy: ${strategy.name}`)
        
        const result = await callMistralExtraction(strategy.prompt, apiKey)
        
        if (result && result.confidence > highestConfidence) {
          bestResult = { ...result, extractionMethod: strategy.name }
          highestConfidence = result.confidence
          console.log(`Strategy ${strategy.name} achieved confidence: ${result.confidence}`)
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

    // If all strategies failed, try fallback pattern matching
    if (!bestResult || bestResult.confidence < 60) {
      console.log('All AI strategies failed, trying fallback pattern matching')
      bestResult = fallbackPatternMatching(ocrText)
    }

    return bestResult || { confidence: 10 }

  } catch (error) {
    console.error('Error in enhanced data extraction:', error)
    return { confidence: 10 }
  }
}

function createComprehensivePrompt(ocrText: string): string {
  return `You are an expert cannabis lab analyst. Extract data from this COA document OCR text.

  CRITICAL: Look for these EXACT patterns and variations:

  THC VALUES - Look for ANY of these patterns:
  - "TOTAL THC" followed by percentage (most common)
  - "THC" in tables with percentage values
  - "Δ9-THC" or "Delta-9-THC" 
  - Numbers like "27.1%" near "THC"
  - "mg/g" values (convert: divide by 10 for flower, by 1000 for concentrates)

  CBD VALUES - Look for:
  - "TOTAL CBD" followed by percentage
  - "CBD" in tables with percentage values
  - Very small numbers like "0.0523%" (common for high-THC flower)

  TERPENES - Look for:
  - Names ending in "-ene": Myrcene, Limonene, Pinene
  - Greek letters: β-Myrcene, α-Pinene, δ-Limonene
  - With percentages typically 0.1% to 3.0%

  BATCH ID - Look for:
  - "BATCH ID", "LOT", "METRC" followed by alphanumeric
  - Patterns like "EVM0581", "1A4060300", etc.

  Return ONLY valid JSON:
  {
    "batchId": "string or null",
    "strainName": "string or null",
    "category": "string or null", 
    "subCategory": "string or null",
    "thcPercentage": number or null,
    "cbdPercentage": number or null,
    "totalCannabinoids": number or null,
    "labName": "string or null",
    "testDate": "YYYY-MM-DD or null",
    "terpenes": [{"name": "string", "percentage": number}] or null
  }

  OCR Text:
  ${ocrText}`
}

function createTableFocusedPrompt(ocrText: string): string {
  return `Focus ONLY on finding data in table structures. Look for:

  CANNABINOID TABLES:
  - Rows with "THC" and percentage columns
  - "TOTAL THC" calculations
  - "CBD" values (often very small like 0.05%)

  TERPENE TABLES:
  - Columns showing terpene names and percentages
  - Look for "%" symbols in terpene sections

  Extract the highest confidence numerical values you find in table formats.

  Return ONLY JSON:
  {
    "thcPercentage": number or null,
    "cbdPercentage": number or null,
    "totalCannabinoids": number or null,
    "terpenes": [{"name": "string", "percentage": number}] or null,
    "batchId": "string or null",
    "strainName": "string or null",
    "labName": "string or null"
  }

  OCR Text:
  ${ocrText}`
}

function createRegexGuidedPrompt(ocrText: string): string {
  // Pre-process text to find likely candidates
  const thcMatches = ocrText.match(/(?:TOTAL\s+)?THC[:\s]*(\d+\.?\d*)\s*%/gi)
  const cbdMatches = ocrText.match(/(?:TOTAL\s+)?CBD[:\s]*(\d+\.?\d*)\s*%/gi)
  const batchMatches = ocrText.match(/(?:BATCH|LOT|METRC)[:\s\w]*([A-Z0-9]{6,})/gi)
  
  return `I found potential matches in the text:
  THC candidates: ${thcMatches?.join(', ') || 'none'}
  CBD candidates: ${cbdMatches?.join(', ') || 'none'} 
  Batch candidates: ${batchMatches?.join(', ') || 'none'}

  Please extract the most accurate values from these candidates and the full text.
  Focus on the highest THC percentage and corresponding CBD value.

  Return ONLY JSON:
  {
    "thcPercentage": number or null,
    "cbdPercentage": number or null,
    "batchId": "string or null",
    "strainName": "string or null"
  }

  Full OCR Text:
  ${ocrText.substring(0, 3000)}...`
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
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`)
    }

    const data: MistralExtractionResponse = await response.json()
    const extractionResult = data.choices[0].message.content

    const parsedData = JSON.parse(extractionResult)
    const confidence = calculateAdvancedConfidence(parsedData)

    return { ...parsedData, confidence }

  } catch (error) {
    console.error('Mistral extraction call failed:', error)
    return null
  }
}

function fallbackPatternMatching(ocrText: string): ExtractedData {
  console.log('Running fallback pattern matching')
  
  const result: ExtractedData = { confidence: 50 }

  // THC Pattern Matching
  const thcPatterns = [
    /TOTAL\s+THC[:\s]+(\d+\.?\d*)\s*%/i,
    /THC[:\s]+(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%.*THC/i
  ]

  for (const pattern of thcPatterns) {
    const match = ocrText.match(pattern)
    if (match) {
      const value = parseFloat(match[1])
      if (value > 0 && value < 100) {
        result.thcPercentage = value
        result.confidence += 20
        break
      }
    }
  }

  // CBD Pattern Matching
  const cbdPatterns = [
    /TOTAL\s+CBD[:\s]+(\d+\.?\d*)\s*%/i,
    /CBD[:\s]+(\d+\.?\d*)\s*%/i
  ]

  for (const pattern of cbdPatterns) {
    const match = ocrText.match(pattern)
    if (match) {
      const value = parseFloat(match[1])
      if (value >= 0 && value < 50) {
        result.cbdPercentage = value
        result.confidence += 15
        break
      }
    }
  }

  // Batch ID Pattern Matching
  const batchPatterns = [
    /BATCH[:\s]*ID[:\s]*([A-Z0-9]+)/i,
    /LOT[:\s]*([A-Z0-9]+)/i,
    /METRC[:\s]*([A-Z0-9]+)/i
  ]

  for (const pattern of batchPatterns) {
    const match = ocrText.match(pattern)
    if (match && match[1].length >= 5) {
      result.batchId = match[1]
      result.confidence += 10
      break
    }
  }

  // Strain name (look for common patterns)
  const strainMatch = ocrText.match(/STRAIN[:\s]*([A-Z][a-z\s]+)(?:\s|$|[^a-z])/i) ||
                     ocrText.match(/SAMPLE[:\s]*([A-Z][a-z\s]+)(?:\s|$|[^a-z])/i)
  
  if (strainMatch) {
    result.strainName = strainMatch[1].trim()
    result.confidence += 10
  }

  console.log('Fallback extraction result:', result)
  return result
}

function calculateAdvancedConfidence(data: any): number {
  let confidence = 30 // Base confidence

  // High value for finding THC (most important)
  if (data.thcPercentage && data.thcPercentage > 0 && data.thcPercentage < 100) {
    confidence += 30
  }

  // CBD value (important but can be very low)
  if (data.cbdPercentage !== undefined && data.cbdPercentage >= 0 && data.cbdPercentage < 50) {
    confidence += 20
  }

  // Other important fields
  if (data.batchId && data.batchId.length >= 5) confidence += 15
  if (data.strainName && data.strainName.length > 2) confidence += 10
  if (data.labName) confidence += 5
  if (data.terpenes && data.terpenes.length > 0) confidence += 10

  // Validate reasonableness of values
  if (data.thcPercentage && data.cbdPercentage) {
    const total = data.thcPercentage + data.cbdPercentage
    if (total > 5 && total < 100) confidence += 5 // Reasonable total
  }

  return Math.min(confidence, 95)
}