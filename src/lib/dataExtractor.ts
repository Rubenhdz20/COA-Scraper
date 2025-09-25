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

    // DEBUG: Show OCR text sample
    console.log('=== OCR TEXT SAMPLE ===')
    console.log(ocrText.substring(0, 1000))
    console.log('=== END SAMPLE ===')

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set')
    }

    // 2River Labs specific extraction strategies
    const strategies = [
      { name: '2river-primary', prompt: create2RiverPrimaryPrompt(ocrText) },
      { name: '2river-fallback', prompt: create2RiverFallbackPrompt(ocrText) },
      { name: 'pattern-matching', prompt: create2RiverPatternPrompt(ocrText) }
    ]

    let bestResult: ExtractedData | null = null
    let highestConfidence = 0

    // Try AI strategies first
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
        if (result && result.confidence >= 90) {
          console.log(`High confidence result found with strategy: ${strategy.name}`)
          break
        }
      } catch (error) {
        console.error(`Strategy ${strategy.name} failed:`, error)
        continue
      }
    }

    // Always run 2River pattern matching as backup
    const patternResult = river2LabsPatternMatching(ocrText)
    if (!bestResult || patternResult.confidence > bestResult.confidence) {
      console.log('Using 2River pattern matching result')
      bestResult = patternResult
    }

    // Set lab name since we know it's 2River
    if (bestResult) {
      bestResult.labName = "2 RIVER LABS, INC"
    }

    return bestResult || { confidence: 10, labName: "2 RIVER LABS, INC" }

  } catch (error) {
    console.error('Error in 2River specialized extraction:', error)
    return { confidence: 10, labName: "2 RIVER LABS, INC" }
  }
}

// PRIMARY: 2River Labs specific prompt knowing exact layout
function create2RiverPrimaryPrompt(ocrText: string): string {
  return `You are extracting data from a 2 RIVER LABS COA document. These documents have a VERY specific format.

EXACT LOCATIONS TO LOOK FOR:

1. BATCH ID: Always format "EVM####" (like EVM0579, EVM0578, EVM0581)
   - Look for "BATCH ID: EVM####" in the header section

2. STRAIN NAME: 
   - Look for "SAMPLE: [STRAIN NAME] (FLOWER)" at the top
   - Strain names like "PURPLE OCTANE", "SWEET JACK", "RED RUNTZ"

3. CATEGORY & SUB-CATEGORY:
   - Category is ALWAYS "INHALABLE" 
   - Sub-category comes from "MATRIX: FLOWER"

4. CANNABINOID VALUES - Look in the "CANNABINOID OVERVIEW" box on the right side:
   - "TOTAL THC: ##.#%" (like "TOTAL THC: 24.2%")
   - "TOTAL CBD: #.####%" (like "TOTAL CBD: 0.0448%") 
   - "TOTAL CANNABINOIDS: ##.#%" (like "TOTAL CANNABINOIDS: 24.3%")

5. TOP TERPENES - If present, look for terpene table with:
   - "TOTAL TERPENES ##.##%" 
   - Individual terpenes like "β-MYRCENE", "D-LIMONENE", "β-CARYOPHYLLENE"
   - Extract the top 3 highest percentage terpenes

6. TEST DATE: Look for date patterns like "JAN 17, 2024"

Return ONLY this JSON:
{
  "batchId": "EVM#### or null",
  "strainName": "STRAIN NAME or null",
  "category": "INHALABLE or null",
  "subCategory": "FLOWER or null", 
  "thcPercentage": number or null,
  "cbdPercentage": number or null,
  "totalCannabinoids": number or null,
  "testDate": "YYYY-MM-DD or null",
  "terpenes": [{"name": "terpene_name", "percentage": number}] or null
}

OCR Text:
${ocrText}`
}

// FALLBACK: Simpler 2River approach
function create2RiverFallbackPrompt(ocrText: string): string {
  return `This is a 2 RIVER LABS cannabis COA. Extract these specific values:

PRIORITY FIELDS (must find these):
- Batch ID starting with "EVM" 
- Total THC percentage 
- Total CBD percentage
- Total Cannabinoids percentage

SECONDARY FIELDS:
- Strain name from sample line
- Top 3 terpenes if terpene testing was done

2River format patterns:
- "BATCH ID: EVM0579"
- "TOTAL THC: 24.2%"
- "TOTAL CBD: 0.0448%"
- "TOTAL CANNABINOIDS: 24.3%"

Return ONLY JSON:
{
  "batchId": "string or null",
  "strainName": "string or null", 
  "category": "INHALABLE",
  "subCategory": "FLOWER",
  "thcPercentage": number or null,
  "cbdPercentage": number or null,
  "totalCannabinoids": number or null,
  "terpenes": [{"name": "name", "percentage": number}] or null
}

OCR Text:
${ocrText.substring(0, 2000)}...`
}

// PATTERN-GUIDED: Show AI the exact patterns found
function create2RiverPatternPrompt(ocrText: string): string {
  // Find 2River specific patterns
  const batchMatch = ocrText.match(/BATCH\s*ID\s*:\s*(EVM\d{4})/i)
  const strainMatch = ocrText.match(/SAMPLE\s*:\s*([A-Z\s]+)\s*\(FLOWER\)/i)
  const thcMatch = ocrText.match(/TOTAL\s+THC\s*:\s*(\d+\.?\d*)\s*%/i)
  const cbdMatch = ocrText.match(/TOTAL\s+CBD\s*:\s*(\d+\.?\d*)\s*%/i) 
  const totalCannMatch = ocrText.match(/TOTAL\s+CANNABINOIDS\s*:\s*(\d+\.?\d*)\s*%/i)

  return `Found these 2River Labs patterns:
Batch: ${batchMatch ? batchMatch[0] : 'not found'}
Strain: ${strainMatch ? strainMatch[0] : 'not found'}  
THC: ${thcMatch ? thcMatch[0] : 'not found'}
CBD: ${cbdMatch ? cbdMatch[0] : 'not found'}
Total Cannabinoids: ${totalCannMatch ? totalCannMatch[0] : 'not found'}

Extract the exact values from these patterns. If any pattern wasn't found, search the full text for similar variations.

Return ONLY JSON:
{
  "batchId": "EVM#### or null",
  "strainName": "strain or null",
  "thcPercentage": number or null,
  "cbdPercentage": number or null, 
  "totalCannabinoids": number or null,
  "category": "INHALABLE",
  "subCategory": "FLOWER"
}

Full text: ${ocrText.substring(0, 1500)}...`
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
        temperature: 0.05, // Very low temperature for precise extraction
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

// 2RIVER LABS SPECIALIZED PATTERN MATCHING
function river2LabsPatternMatching(ocrText: string): ExtractedData {
  console.log('Running 2River Labs specialized pattern matching')
  
  const result: ExtractedData = { 
    confidence: 70, // Start higher since we know the format
    labName: "2 RIVER LABS, INC",
    category: "INHALABLE"
  }

  // 1. BATCH ID - 2River always uses EVM#### format
  const batchPatterns = [
    /BATCH\s*ID\s*:\s*(EVM\d{4})/i,
    /BATCH\s*ID\s*(EVM\d{4})/i,
    /(EVM\d{4})/g  // Catch any EVM#### pattern
  ]

  for (const pattern of batchPatterns) {
    const match = ocrText.match(pattern)
    if (match) {
      result.batchId = match[1] || match[0]
      result.confidence += 15
      console.log(`Found batch ID: ${result.batchId}`)
      break
    }
  }

  // 2. STRAIN NAME - from "SAMPLE: STRAIN NAME (FLOWER)"
  const strainPatterns = [
    /SAMPLE\s*:\s*([A-Z][A-Z\s]+?)\s*\(FLOWER\)/i,
    /SAMPLE\s*:\s*([A-Z][A-Z\s]+?)\s*\/\/\s*CLIENT/i
  ]

  for (const pattern of strainPatterns) {
    const match = ocrText.match(pattern)
    if (match && match[1].trim().length > 2) {
      result.strainName = match[1].trim()
      result.confidence += 10
      console.log(`Found strain: ${result.strainName}`)
      break
    }
  }

  // 3. MATRIX/SUB-CATEGORY 
  if (ocrText.includes('MATRIX: FLOWER') || ocrText.includes('FLOWER')) {
    result.subCategory = 'FLOWER'
    result.confidence += 5
  }

  // 4. CANNABINOID VALUES - 2River specific format
  // THC - "TOTAL THC: 24.2%"
  const thcPatterns = [
    /TOTAL\s+THC\s*:\s*(\d+\.?\d*)\s*%/gi,
    /TOTAL\s+THC\s+(\d+\.?\d*)\s*%/gi
  ]

  for (const pattern of thcPatterns) {
    const matches = [...ocrText.matchAll(pattern)]
    if (matches.length > 0) {
      const value = parseFloat(matches[0][1])
      if (value > 0 && value < 100) {
        result.thcPercentage = value
        result.confidence += 25 // High value for THC
        console.log(`Found THC: ${value}%`)
        break
      }
    }
  }

  // CBD - "TOTAL CBD: 0.0448%"  
  const cbdPatterns = [
    /TOTAL\s+CBD\s*:\s*(\d+\.?\d*)\s*%/gi,
    /TOTAL\s+CBD\s+(\d+\.?\d*)\s*%/gi
  ]

  for (const pattern of cbdPatterns) {
    const matches = [...ocrText.matchAll(pattern)]
    if (matches.length > 0) {
      const value = parseFloat(matches[0][1])
      if (value >= 0 && value < 50) {
        result.cbdPercentage = value
        result.confidence += 20
        console.log(`Found CBD: ${value}%`)
        break
      }
    }
  }

  // TOTAL CANNABINOIDS - "TOTAL CANNABINOIDS: 24.3%"
  const totalCannPatterns = [
    /TOTAL\s+CANNABINOIDS\s*:\s*(\d+\.?\d*)\s*%/gi,
    /TOTAL\s+CANNABINOIDS\s+(\d+\.?\d*)\s*%/gi
  ]

  for (const pattern of totalCannPatterns) {
    const matches = [...ocrText.matchAll(pattern)]
    if (matches.length > 0) {
      const value = parseFloat(matches[0][1])
      if (value > 0 && value <= 100) {
        result.totalCannabinoids = value
        result.confidence += 20
        console.log(`Found Total Cannabinoids: ${value}%`)
        break
      }
    }
  }

  // 5. TOP TERPENES - Extract from terpene table if present
  const terpenes: Array<{ name: string; percentage: number }> = []
  
  // Common 2River terpene patterns
  const terpenePatterns = [
    /([βα]?\s*-?\s*[A-Z]+[A-Z\s-]*?ENE)\s+(\d+\.?\d*)\s*%\s+[\d\.]+\s*mg\/g/gi,
    /(D-LIMONENE|LIMONENE)\s+(\d+\.?\d*)\s*%/gi,
    /(LINALOOL)\s+(\d+\.?\d*)\s*%/gi,
    /(MYRCENE)\s+(\d+\.?\d*)\s*%/gi,
    /(CARYOPHYLLENE)\s+(\d+\.?\d*)\s*%/gi
  ]

  for (const pattern of terpenePatterns) {
    const matches = [...ocrText.matchAll(pattern)]
    for (const match of matches) {
      const name = match[1].trim()
      const percentage = parseFloat(match[2])
      if (percentage > 0 && percentage < 10) {
        terpenes.push({ name, percentage })
      }
    }
  }

  // Sort by percentage and take top 3
  if (terpenes.length > 0) {
    terpenes.sort((a, b) => b.percentage - a.percentage)
    result.terpenes = terpenes.slice(0, 3)
    result.confidence += 10
    console.log(`Found ${terpenes.length} terpenes, top 3:`, result.terpenes)
  }

  // 6. TEST DATE - Look for date patterns
  const datePatterns = [
    /(\w{3}\s+\d{1,2},?\s+\d{4})/g, // "JAN 17, 2024"
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,   // "01/17/2024"
  ]

  for (const pattern of datePatterns) {
    const match = ocrText.match(pattern)
    if (match) {
      try {
        const date = new Date(match[1])
        if (!isNaN(date.getTime())) {
          result.testDate = date.toISOString().split('T')[0] // YYYY-MM-DD format
          result.confidence += 5
          console.log(`Found test date: ${result.testDate}`)
          break
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }

  console.log('2River pattern matching final result:', result)
  return result
}

// 2RIVER SPECIFIC CONFIDENCE CALCULATION
function calculate2RiverConfidence(data: any): number {
  let confidence = 40 // Base confidence for 2River format

  // Critical 2River fields
  if (data.batchId && data.batchId.match(/EVM\d{4}/)) confidence += 20
  if (data.thcPercentage && data.thcPercentage > 0 && data.thcPercentage < 100) confidence += 25
  if (data.cbdPercentage !== undefined && data.cbdPercentage >= 0 && data.cbdPercentage < 50) confidence += 20
  if (data.totalCannabinoids && data.totalCannabinoids > 0 && data.totalCannabinoids <= 100) confidence += 15

  // 2River standard fields
  if (data.strainName && data.strainName.length > 2) confidence += 10
  if (data.category === 'INHALABLE') confidence += 5
  if (data.subCategory === 'FLOWER') confidence += 5
  if (data.terpenes && data.terpenes.length > 0) confidence += 10

  // Validate reasonableness for 2River
  if (data.thcPercentage && data.totalCannabinoids) {
    const diff = Math.abs(data.totalCannabinoids - data.thcPercentage)
    if (diff < 5) confidence += 5 // Total should be close to THC for high-THC flower
  }

  return Math.min(confidence, 98) // Cap at 98% for 2River
}