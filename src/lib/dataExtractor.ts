// src/lib/dataExtractor.ts
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
    console.log('Starting AI data extraction from OCR text')
    console.log('OCR text length:', ocrText.length)

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set')
    }

    // Create a detailed prompt for cannabis data extraction
    const extractionPrompt = `
You are an expert at analyzing Certificate of Analysis (COA) documents for cannabis products. Extract the following information from this OCR text and return it as valid JSON.

IMPORTANT: Look carefully for numerical values, percentages, and specific cannabis terminology.

Extract these fields:
- batchId: The batch/lot number (often starts with letters/numbers like "EVM0581", "1A4", etc.)
- strainName: The cannabis strain name (like "Red Runtz", "Blue Dream", etc.)
- category: Product category (Flower, Concentrate, Edible, Vape, etc.)
- subCategory: More specific type (Cartridge, Live Resin, Gummies, etc.)
- thcPercentage: Look for "THC", "TOTAL THC", "Δ9-THC" followed by percentage (e.g., "27.1%", "90.51%")
- cbdPercentage: Look for "CBD", "TOTAL CBD" followed by percentage 
- totalCannabinoids: Look for "Total Cannabinoids", "Sum of Cannabinoids" followed by percentage
- labName: Testing laboratory name (like "2 River Labs", "SC Labs", etc.)
- testDate: Test date in any format - convert to ISO format
- terpenes: Array of {name: string, percentage: number} - look for terpene names like "β-Myrcene", "Limonene", "Pinene" with their percentages

EXTRACTION TIPS:
- Look for tables with cannabinoid results
- THC percentages are often the highest numbers (15-35% for flower, 70-95% for concentrates)
- CBD is usually much lower (0.01-20%)
- Terpene percentages are typically 0.1-3%
- Pay attention to decimal numbers followed by % symbols
- Sometimes values are listed as "mg/g" - convert to percentage if needed

Return ONLY valid JSON in this exact format:
{
  "batchId": "string or null",
  "strainName": "string or null", 
  "category": "string or null",
  "subCategory": "string or null",
  "thcPercentage": number or null,
  "cbdPercentage": number or null,
  "totalCannabinoids": number or null,
  "labName": "string or null",
  "testDate": "ISO date string or null",
  "terpenes": [{"name": "string", "percentage": number}] or null
}

OCR Text to analyze:
${ocrText}
`

    // Call Mistral API for data extraction
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1, // Low temperature for consistent extraction
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Mistral extraction API error:', response.status, errorText)
      throw new Error(`Mistral extraction API error: ${response.status}`)
    }

    const data: MistralExtractionResponse = await response.json()
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No extraction result returned from Mistral API')
    }

    const extractionResult = data.choices[0].message.content
    console.log('Raw extraction result:', extractionResult)

    // Parse the JSON response
    let parsedData: any
    try {
      parsedData = JSON.parse(extractionResult)
    } catch (parseError) {
      console.error('Failed to parse extraction JSON:', parseError)
      console.error('Raw result:', extractionResult)
      throw new Error('Invalid JSON returned from extraction API')
    }

    // Calculate confidence based on how much data was extracted
    const confidence = calculateExtractionConfidence(parsedData, ocrText)

    const result: ExtractedData = {
      batchId: parsedData.batchId || undefined,
      strainName: parsedData.strainName || undefined,
      category: parsedData.category || undefined,
      subCategory: parsedData.subCategory || undefined,
      thcPercentage: parsedData.thcPercentage || undefined,
      cbdPercentage: parsedData.cbdPercentage || undefined,
      totalCannabinoids: parsedData.totalCannabinoids || undefined,
      labName: parsedData.labName || undefined,
      testDate: parsedData.testDate || undefined,
      terpenes: parsedData.terpenes || undefined,
      confidence: confidence
    }

    console.log('Extraction completed successfully')
    console.log('Extracted data:', JSON.stringify(result, null, 2))

    return result

  } catch (error) {
    console.error('Error in AI data extraction:', error)
    
    // Return a low-confidence result rather than failing completely
    return {
      confidence: 10
    }
  }
}

function calculateExtractionConfidence(extractedData: any, originalText: string): number {
  let confidence = 20 // Base confidence for completing the extraction
  
  // Add confidence for each successfully extracted field
  const fields = [
    'batchId', 'strainName', 'category', 'thcPercentage', 
    'cbdPercentage', 'labName', 'testDate'
  ]
  
  fields.forEach(field => {
    if (extractedData[field] && extractedData[field] !== null) {
      confidence += 8
    }
  })
  
  // Extra confidence for terpenes (complex extraction)
  if (extractedData.terpenes && Array.isArray(extractedData.terpenes) && extractedData.terpenes.length > 0) {
    confidence += 15
  }
  
  // Validate that percentages are reasonable
  if (extractedData.thcPercentage && extractedData.thcPercentage > 0 && extractedData.thcPercentage < 100) {
    confidence += 5
  }
  
  if (extractedData.cbdPercentage && extractedData.cbdPercentage >= 0 && extractedData.cbdPercentage < 100) {
    confidence += 5
  }
  
  // Check if extracted data makes sense in context
  if (extractedData.strainName && originalText.toLowerCase().includes(extractedData.strainName.toLowerCase())) {
    confidence += 10
  }
  
  // Cap confidence at 95%
  return Math.min(confidence, 95)
}