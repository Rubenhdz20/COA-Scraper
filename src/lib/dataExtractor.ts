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

// DIAGNOSTIC VERSION - Replace your dataExtractor.ts temporarily with this
export async function extractDataFromOCRText(ocrText: string): Promise<ExtractedData> {
  try {
    console.log('=== DIAGNOSTIC MODE ENABLED ===')
    console.log('OCR text length:', ocrText.length)

    // DIAGNOSTIC: Find all lines containing THC, CBD, or CANNABINOIDS
    console.log('\n=== RAW OCR ANALYSIS ===')
    const lines = ocrText.split('\n')
    const relevantLines = lines.filter(line => 
      /thc|cbd|cannabinoid/i.test(line) && 
      /\d+/.test(line) && 
      /%/.test(line)
    )
    console.log('Found', relevantLines.length, 'lines with cannabinoid + number + %:')
    relevantLines.forEach((line, i) => {
      console.log(`Line ${i + 1}: "${line}"`)
    })

    // DIAGNOSTIC: Show all percentages in the document
    console.log('\n=== ALL PERCENTAGES FOUND ===')
    const allPercentages = ocrText.match(/\d+\.?\d*\s*%/g) || []
    console.log('All percentage patterns:', allPercentages.slice(0, 20)) // Show first 20

    // DIAGNOSTIC: Search for "TOTAL" + any cannabinoid term
    console.log('\n=== TOTAL + CANNABINOID PATTERNS ===')
    const totalPatterns = ocrText.match(/TOTAL[^%]*?(\d+\.?\d*\s*%)/gi) || []
    console.log('TOTAL patterns found:', totalPatterns.slice(0, 10))

    // DIAGNOSTIC: Look for the specific section
    console.log('\n=== CANNABINOID OVERVIEW SECTION ===')
    const overviewMatch = ocrText.match(/CANNABINOID\s+OVERVIEW[\s\S]*?(?=\n\s*\n|\n[A-Z]{3,}|$)/i)
    if (overviewMatch) {
      console.log('Found CANNABINOID OVERVIEW section:')
      console.log(overviewMatch[0].substring(0, 500))
    } else {
      console.log('CANNABINOID OVERVIEW section NOT found')
      
      // Look for just "OVERVIEW"
      const overviewSimple = ocrText.match(/OVERVIEW[\s\S]*?(?=\n\s*\n|\n[A-Z]{3,}|$)/i)
      if (overviewSimple) {
        console.log('Found OVERVIEW section:')
        console.log(overviewSimple[0].substring(0, 500))
      }
    }

    // DIAGNOSTIC: Character-by-character analysis around potential cannabinoid data
    console.log('\n=== CHARACTER ANALYSIS ===')
    const thcIndex = ocrText.toLowerCase().indexOf('total thc')
    if (thcIndex !== -1) {
      const snippet = ocrText.substring(thcIndex - 10, thcIndex + 50)
      console.log('Text around "total thc":')
      console.log(`"${snippet}"`)
      console.log('Character codes:', snippet.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '))
    } else {
      console.log('String "total thc" not found')
      
      // Look for just "thc"
      const thcSimpleIndex = ocrText.toLowerCase().indexOf('thc')
      if (thcSimpleIndex !== -1) {
        const snippet = ocrText.substring(thcSimpleIndex - 10, thcSimpleIndex + 30)
        console.log('Text around first "thc":')
        console.log(`"${snippet}"`)
      }
    }

    console.log('\n=== ATTEMPTING EXTRACTION WITH CURRENT LOGIC ===')

    // Run your existing extraction logic
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set')
    }

    // Continue with existing logic but with enhanced debugging...
    const cleanedText = cleanOCRText(ocrText)
    
    console.log('=== CLEANED TEXT COMPARISON ===')
    if (cleanedText !== ocrText) {
      console.log('Text was modified during cleaning')
      console.log('Original snippet (first 300 chars):', ocrText.substring(0, 300))
      console.log('Cleaned snippet (first 300 chars):', cleanedText.substring(0, 300))
      
      // Check if cleaning helped with THC detection
      const thcBefore = ocrText.match(/th[cg][^%]*?\d+\.?\d*\s*%/gi) || []
      const thcAfter = cleanedText.match(/th[cg][^%]*?\d+\.?\d*\s*%/gi) || []
      console.log('THC patterns before cleaning:', thcBefore.slice(0, 3))
      console.log('THC patterns after cleaning:', thcAfter.slice(0, 3))
    }

    // Pattern matching with enhanced debugging
    const patternResult = river2LabsPatternMatchingDiagnostic(cleanedText)
    console.log('Pattern matching result:', {
      thc: patternResult.thcPercentage,
      cbd: patternResult.cbdPercentage, 
      total: patternResult.totalCannabinoids,
      confidence: patternResult.confidence
    })

    // Continue with AI strategies...
    const strategies = [
      { name: '2river-primary', prompt: create2RiverPrimaryPrompt(cleanedText, patternResult) },
    ]

    let bestResult: ExtractedData | null = null
    let highestConfidence = 0

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

        if (result && result.confidence >= 85) {
          break
        }
      } catch (error) {
        console.error(`Strategy ${strategy.name} failed:`, error)
        continue
      }
    }

    // Merge results
    const finalResult = mergeBestResults(bestResult, patternResult)
    
    if (finalResult) {
      finalResult.labName = "2 RIVER LABS, INC"
    }

    console.log('=== DIAGNOSTIC COMPLETE ===')
    return finalResult || { confidence: 10, labName: "2 RIVER LABS, INC" }

  } catch (error) {
    console.error('Error in diagnostic extraction:', error)
    return { confidence: 10, labName: "2 RIVER LABS, INC" }
  }
}

// Enhanced diagnostic pattern matching
function river2LabsPatternMatchingDiagnostic(ocrText: string): ExtractedData {
  console.log('\n=== ENHANCED PATTERN MATCHING DIAGNOSTICS ===')
  
  const result: ExtractedData = { 
    confidence: 70,
    labName: "2 RIVER LABS, INC",
    category: "INHALABLE"
  }

  // 1. BATCH ID - Quick find
  const batchPatterns = [
    /BATCH\s*ID\s*:?\s*(EVM\d{4})/i,
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

  // 2. STRAIN NAME - Quick find
  const strainPatterns = [
    /SAMPLE\s*:?\s*([A-Z][A-Z\s&-]+?)\s*\(?FLOWER/i,
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

  // Test EVERY possible THC pattern variation
  console.log('\n🔍 Testing THC patterns...')
  const thcPatterns = [
    // Standard
    /TOTAL\s+THC\s*:?\s*(\d+\.?\d*)\s*%/gi,
    // Loose spacing
    /TOTAL[\s\n]+THC[\s\n]*:?[\s\n]*(\d+\.?\d*)\s*%/gi,
    // Missing TOTAL
    /(?:^|\n)\s*THC\s*:?\s*(\d+\.?\d*)\s*%/gim,
    // Spaced characters
    /T\s*O\s*T\s*A\s*L\s*\s+T\s*H\s*C\s*:?\s*(\d+\.?\d*)\s*%/gi,
    // Any THC followed by percentage within reasonable distance
    /THC[^\d]*?(\d+\.?\d*)\s*%/gi,
    // Line breaks
    /TOTAL\s*THC[\n\r\s]*:?[\n\r\s]*(\d+\.?\d*)\s*%/gi,
    // With colon variations
    /TOTAL\s+THC\s*[\:\-\=]\s*(\d+\.?\d*)\s*%/gi
  ]

  for (const [index, pattern] of thcPatterns.entries()) {
    const matches = [...ocrText.matchAll(pattern)]
    console.log(`THC Pattern ${index + 1} (${pattern.source.substring(0, 30)}...): ${matches.length} matches`)
    
    if (matches.length > 0) {
      matches.forEach((match, i) => {
        console.log(`  Match ${i + 1}: "${match[0]}" -> value: "${match[1]}"`)
        const value = parseFloat(match[1])
        if (value > 0 && value <= 50 && !result.thcPercentage) {
          result.thcPercentage = value
          result.confidence += 30
          console.log(`  ✅ ACCEPTED THC: ${value}%`)
        }
      })
      if (result.thcPercentage) break
    }
  }

  // Test CBD patterns
  console.log('\n🔍 Testing CBD patterns...')
  const cbdPatterns = [
    /TOTAL\s+CBD\s*:?\s*(\d+\.?\d*)\s*%/gi,
    /TOTAL[\s\n]+CBD[\s\n]*:?[\s\n]*(\d+\.?\d*)\s*%/gi,
    /(?:^|\n)\s*CBD\s*:?\s*(\d+\.?\d*)\s*%/gim,
    /CBD[^\d]*?(\d+\.?\d*)\s*%/gi,
    /TOTAL\s+CBD\s*[\:\-\=]\s*(\d+\.?\d*)\s*%/gi
  ]

  for (const [index, pattern] of cbdPatterns.entries()) {
    const matches = [...ocrText.matchAll(pattern)]
    console.log(`CBD Pattern ${index + 1}: ${matches.length} matches`)
    
    if (matches.length > 0) {
      matches.forEach((match, i) => {
        console.log(`  Match ${i + 1}: "${match[0]}" -> value: "${match[1]}"`)
        const value = parseFloat(match[1])
        if (value >= 0 && value <= 30 && result.cbdPercentage === undefined) {
          result.cbdPercentage = value
          result.confidence += 25
          console.log(`  ✅ ACCEPTED CBD: ${value}%`)
        }
      })
      if (result.cbdPercentage !== undefined) break
    }
  }

  // Test TOTAL CANNABINOIDS patterns
  console.log('\n🔍 Testing TOTAL CANNABINOIDS patterns...')
  const totalPatterns = [
    /TOTAL\s+CANNABINOIDS\s*:?\s*(\d+\.?\d*)\s*%/gi,
    /TOTAL[\s\n]+CANNABINOIDS[\s\n]*:?[\s\n]*(\d+\.?\d*)\s*%/gi,
    /CANNABINOIDS[^\d]*?(\d+\.?\d*)\s*%/gi,
    /TOTAL\s+CANNABINOIDS\s*[\:\-\=]\s*(\d+\.?\d*)\s*%/gi
  ]

  for (const [index, pattern] of totalPatterns.entries()) {
    const matches = [...ocrText.matchAll(pattern)]
    console.log(`Total Cannabinoids Pattern ${index + 1}: ${matches.length} matches`)
    
    if (matches.length > 0) {
      matches.forEach((match, i) => {
        console.log(`  Match ${i + 1}: "${match[0]}" -> value: "${match[1]}"`)
        const value = parseFloat(match[1])
        if (value > 0 && value <= 60) {
          // Additional validation: should be >= THC if THC exists
          if (!result.thcPercentage || value >= result.thcPercentage) {
            result.totalCannabinoids = value
            result.confidence += 25
            console.log(`  ✅ ACCEPTED Total Cannabinoids: ${value}%`)
          } else {
            console.log(`  ❌ REJECTED: ${value}% < THC ${result.thcPercentage}%`)
          }
        }
      })
      if (result.totalCannabinoids) break
    }
  }

  console.log('\n=== PATTERN MATCHING SUMMARY ===')
  console.log(`THC Found: ${result.thcPercentage || 'NO'}`)
  console.log(`CBD Found: ${result.cbdPercentage !== undefined ? result.cbdPercentage : 'NO'}`) 
  console.log(`Total Found: ${result.totalCannabinoids || 'NO'}`)
  console.log(`Final Confidence: ${result.confidence}`)

  return result
}

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

function mergeBestResults(aiResult: ExtractedData | null, patternResult: ExtractedData): ExtractedData {
  const merged = { ...patternResult }
  
  if (aiResult) {
    if (!merged.batchId && aiResult.batchId) merged.batchId = aiResult.batchId
    if (!merged.strainName && aiResult.strainName) merged.strainName = aiResult.strainName
    if (!merged.thcPercentage && aiResult.thcPercentage) merged.thcPercentage = aiResult.thcPercentage
    if (!merged.cbdPercentage && aiResult.cbdPercentage) merged.cbdPercentage = aiResult.cbdPercentage
    if (!merged.totalCannabinoids && aiResult.totalCannabinoids) merged.totalCannabinoids = aiResult.totalCannabinoids
    
    if (aiResult.confidence > merged.confidence) {
      merged.confidence = aiResult.confidence
      merged.extractionMethod = aiResult.extractionMethod
    }
  }
  
  return merged
}

function create2RiverPrimaryPrompt(ocrText: string, patternHints: ExtractedData): string {
  return `Extract cannabinoid data from this 2River Labs COA. Look for TOTAL THC, TOTAL CBD, and TOTAL CANNABINOIDS percentages.

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
        temperature: 0.01,
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
    const confidence = 50 // Simplified for diagnostic

    return { ...parsedData, confidence }

  } catch (error) {
    console.error('Mistral extraction call failed:', error)
    return null
  }
}