// src/lib/dataExtractor.ts

// Define types inline instead of importing
interface Terpene {
  name: string;
  percentage: number;
}

interface ExtractedCOAData {
  batchId: string | null;
  strainName: string | null;
  thcPercentage: number | null;
  cbdPercentage: number | null;
  terpenes: Terpene[];
  totalCannabinoids: number | null;
  labName: string | null;
  testDate: string | null;
}

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  confidence: number;
}

export function extractCOAData(ocrText: string): ExtractedCOAData {
  const data: ExtractedCOAData = {
    batchId: null,
    strainName: null,
    thcPercentage: null,
    cbdPercentage: null,
    terpenes: [],
    totalCannabinoids: null,
    labName: null,
    testDate: null
  }

  // Clean up the text - normalize whitespace and remove extra characters
  const cleanText = ocrText
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\.\-\%\(\)\|\:\;\,]/g, ' ')
    .trim()

  // BATCH ID EXTRACTION
  const batchPatterns = [
    /batch\s*id[:\s]*([A-Z0-9\-#]{6,})/i,
    /metrc\s*batch[:\s]*([A-Z0-9\-#]{6,})/i,
    /batch[:\s]*([A-Z0-9\-#]{6,})/i,
    /#([A-Z0-9]{10,})/i, // Pattern like #1A4090001234567
    /batch[:\s]*([A-Z]{2,}\d{3,})/i, // Pattern like EVM0581
    /metrc\s*source\s*uid[:\s]*([A-Z0-9]{10,})/i
  ]

  for (const pattern of batchPatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      data.batchId = match[1].replace(/^#+/, '') // Remove leading #
      break
    }
  }

  // STRAIN NAME EXTRACTION
  const strainPatterns = [
    /strain[:\s]*([^|\n\r(]+?)(?:\s*\[|\s*\(|$)/i,
    /sample[:\s]*([^(\n\r]+?)(?:\s*\(|$)/i, // "RED RUNTZ (FLOWER)"
    /product[:\s]*([^|\n\r]+?)(?:\s*\||$)/i,
    // For formats like "1g Cart | Cereal Milk [H]"
    /cart\s*\|\s*([^[\n\r]+?)(?:\s*\[|$)/i,
    // Match strain names in headers - common cannabis strain patterns
    /\b(OG\s+[A-Z][a-z]+|[A-Z][a-z]+\s+(?:Kush|Dream|Haze|Diesel|Cheese|Cookies))\b/i,
    // General pattern for strain-like names
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*\[|\s*\(|\s*$)/
  ]

  for (const pattern of strainPatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      let strainName = match[1].trim()
      // Clean up common artifacts
      strainName = strainName.replace(/\s+/g, ' ')
      strainName = strainName.replace(/^(sample|strain|product)[:]*\s*/i, '')
      
      if (strainName.length > 3 && strainName.length < 50) {
        data.strainName = strainName
        break
      }
    }
  }

  // THC PERCENTAGE EXTRACTION
  const thcPatterns = [
    /total\s+thc[:\s]*(\d+\.?\d*)\s*%/i,
    /thc\s*%[:\s]*(\d+\.?\d*)/i,
    /thc[:\s]*(\d+\.?\d*)\s*%/i,
    // For high concentration products like vapes
    /(\d{2,3}\.\d{1,2})\s*%.*thc/i,
    // Table format: THC followed by percentage
    /thc\s+(\d+\.?\d*)/i
  ]

  for (const pattern of thcPatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      const percentage = parseFloat(match[1])
      if (percentage >= 0 && percentage <= 100) {
        data.thcPercentage = percentage
        break
      }
    }
  }

  // CBD PERCENTAGE EXTRACTION
  const cbdPatterns = [
    /total\s+cbd[:\s]*(\d+\.?\d*)\s*%/i,
    /cbd\s*%[:\s]*(\d+\.?\d*)/i,
    /cbd[:\s]*(\d+\.?\d*)\s*%/i,
    /cbd\s+(\d+\.?\d*)/i
  ]

  for (const pattern of cbdPatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      const percentage = parseFloat(match[1])
      if (percentage >= 0 && percentage <= 100) {
        data.cbdPercentage = percentage
        break
      }
    }
  }

  // TERPENES EXTRACTION
  const terpeneNames = [
    'myrcene', 'caryophyllene', 'limonene', 'pinene', 'linalool', 'humulene',
    'terpinolene', 'ocimene', 'bisabolol', 'nerolidol', 'camphene', 'valencene',
    'borneol', 'fenchol', 'terpineol', 'guaiol', 'eucalyptol', 'geraniol'
  ]

  const terpenePatterns = [
    // β-Caryophyllene - 1.8%
    /(β|beta|α|alpha|δ|delta|γ|gamma)-?([a-z]+(?:ene|ol|ine|ene))[:\s\-]*(\d+\.?\d*)\s*%/gi,
    // D-Limonene 0.450 %
    /([a-z]-?[a-z]+(?:ene|ol|ine))[:\s]*(\d+\.?\d*)\s*%/gi,
    // Standard format in tables
    /\b((?:beta|alpha|gamma|delta)-?[a-z]+(?:ene|ol|ine))\s+(\d+\.?\d*)/gi
  ]

  const foundTerpenes = new Set<string>()

  terpenePatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(cleanText)) !== null) {
      let name: string
      let percentage: number

      if (match.length === 4) {
        // Pattern with Greek letters
        name = `${match[1]}-${match[2]}`
        percentage = parseFloat(match[3])
      } else {
        name = match[1]
        percentage = parseFloat(match[2])
      }

      // Validate terpene
      const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '')
      const isValidTerpene = terpeneNames.some(validName => 
        normalizedName.includes(validName) || validName.includes(normalizedName)
      )

      if (isValidTerpene && percentage > 0 && percentage < 50) {
        const formattedName = formatTerpeneName(name)
        const key = `${formattedName}-${percentage}`
        
        if (!foundTerpenes.has(key)) {
          foundTerpenes.add(key)
          data.terpenes.push({
            name: formattedName,
            percentage: percentage
          })
        }
      }
    }
  })

  // Sort terpenes by percentage descending
  data.terpenes.sort((a, b) => b.percentage - a.percentage)

  // TOTAL CANNABINOIDS
  const cannabinoidPatterns = [
    /total\s+cannabinoids[:\s]*(\d+\.?\d*)\s*%/i,
    /cannabinoids[:\s]*(\d+\.?\d*)\s*%/i,
    /sum\s+of\s+cannabinoids[:\s]*(\d+\.?\d*)\s*%/i
  ]

  for (const pattern of cannabinoidPatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      const percentage = parseFloat(match[1])
      if (percentage >= 0 && percentage <= 100) {
        data.totalCannabinoids = percentage
        break
      }
    }
  }

  // LAB NAME EXTRACTION
  const labPatterns = [
    /(\d+\s*river\s*labs)/i,
    /(.*labs.*inc)/i,
    /lab[:\s]*([^,\n]+)/i,
    /(cannasafe|sc\s*labs|steep\s*hill)/i
  ]

  for (const pattern of labPatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      data.labName = match[1].trim()
      break
    }
  }

  // TEST DATE EXTRACTION
  const datePatterns = [
    /produced[:\s]*([A-Z]{3}\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /([A-Z]{3}\s+\d{1,2},?\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/
  ]

  for (const pattern of datePatterns) {
    const match = cleanText.match(pattern)
    if (match) {
      data.testDate = match[1]
      break
    }
  }

  return data
}

// Helper function to format terpene names consistently
function formatTerpeneName(name: string): string {
  const formatted = name.toLowerCase().replace(/[^a-z\-]/g, '')
  
  // Common terpene name mappings
  const terpeneMap: Record<string, string> = {
    'caryophyllene': 'β-Caryophyllene',
    'beta-caryophyllene': 'β-Caryophyllene',
    'bcaryophyllene': 'β-Caryophyllene',
    'limonene': 'D-Limonene',
    'd-limonene': 'D-Limonene',
    'myrcene': 'β-Myrcene',
    'beta-myrcene': 'β-Myrcene',
    'bmyrcene': 'β-Myrcene',
    'humulene': 'α-Humulene',
    'alpha-humulene': 'α-Humulene',
    'ahumulene': 'α-Humulene',
    'pinene': 'α-Pinene',
    'alpha-pinene': 'α-Pinene',
    'apinene': 'α-Pinene',
    'linalool': 'Linalool',
    'terpinolene': 'Terpinolene',
    'nerolidol': 'Nerolidol',
    'trans-nerolidol': 'Trans-Nerolidol',
    'ocimene': 'Ocimene',
    'bisabolol': 'α-Bisabolol',
    'alpha-bisabolol': 'α-Bisabolol'
  }

  // Check for exact matches first
  if (terpeneMap[formatted]) {
    return terpeneMap[formatted]
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(terpeneMap)) {
    if (formatted.includes(key.replace('-', ''))) {
      return value
    }
  }

  // If no match, return capitalized version
  return name.split('-').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join('-')
}

// Validation function for extracted data
export function validateExtractedData(data: ExtractedCOAData): ValidationResult {
  const issues: string[] = []
  let confidence = 100

  // Check for required fields
  if (!data.batchId) {
    issues.push("Batch ID not found")
    confidence -= 20
  }
  
  if (!data.strainName) {
    issues.push("Strain name not found")
    confidence -= 15
  }
  
  if (data.thcPercentage === null) {
    issues.push("THC percentage not found")
    confidence -= 25
  }
  
  if (data.cbdPercentage === null) {
    issues.push("CBD percentage not found")
    confidence -= 10
  }

  // Validate ranges
  if (data.thcPercentage !== null && (data.thcPercentage < 0 || data.thcPercentage > 100)) {
    issues.push("THC percentage out of valid range (0-100%)")
    confidence -= 30
  }
  
  if (data.cbdPercentage !== null && (data.cbdPercentage < 0 || data.cbdPercentage > 100)) {
    issues.push("CBD percentage out of valid range (0-100%)")
    confidence -= 30
  }

  // Check for suspicious values
  if (data.thcPercentage !== null && data.thcPercentage > 50) {
    issues.push("Unusually high THC percentage detected")
    confidence -= 10
  }

  if (data.terpenes.length === 0) {
    issues.push("No terpenes extracted")
    confidence -= 5
  }

  // Boost confidence for additional data
  if (data.labName) confidence += 5
  if (data.testDate) confidence += 5
  if (data.totalCannabinoids) confidence += 5

  return {
    isValid: issues.length === 0,
    issues,
    confidence: Math.max(Math.min(confidence, 99), 10)
  }
}