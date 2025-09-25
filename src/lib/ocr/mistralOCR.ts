import { Mistral } from '@mistralai/mistralai'
import fs from 'fs'

export interface OCRResult {
  success: boolean
  extractedText: string
  confidence?: number
  processingTime: number
  provider: string
  error?: string
  metadata?: {
    pageCount?: number
    language?: string
    hasImages?: boolean
    hasTables?: boolean
  }
}

class MistralOCRService {
  private client: Mistral
  private readonly maxFileSize: number
  private readonly timeout: number

  constructor() {
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is required')
    }

    this.client = new Mistral({ apiKey })
    this.maxFileSize = parseInt(process.env.OCR_MAX_FILE_SIZE || '52428800') // 50MB
    this.timeout = parseInt(process.env.OCR_TIMEOUT || '120000') // 2 minutes
  }

  async processDocument(filePath: string): Promise<OCRResult> {
    const startTime = Date.now()

    try {
      console.log('Starting Mistral OCR processing for:', filePath)

      // Validate file exists and size
      const stats = await fs.promises.stat(filePath)
      if (stats.size > this.maxFileSize) {
        return {
          success: false,
          extractedText: '',
          processingTime: Date.now() - startTime,
          provider: 'mistral-ocr',
          error: `File size ${stats.size} bytes exceeds maximum ${this.maxFileSize} bytes`
        }
      }

      // Encode PDF to base64
      console.log('Encoding PDF to base64...')
      const base64Pdf = await this.encodePdf(filePath)
      
      // Process with Mistral OCR API
      console.log('Processing with Mistral OCR API...')
      const ocrResponse = await Promise.race([
        this.client.ocr.process({
          model: "mistral-ocr-latest",
          document: {
            type: "document_url",
            documentUrl: `data:application/pdf;base64,${base64Pdf}`
          },
          includeImageBase64: false // We don't need images, just text
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OCR processing timeout')), this.timeout)
        )
      ])

      console.log('OCR processing completed successfully')
      
      // Extract text from the OCR response
      const rawText = this.extractTextFromResponse(ocrResponse)
      
      if (!rawText || rawText.trim().length === 0) {
        throw new Error('No text could be extracted from the document')
      }

      console.log('Raw extracted text length:', rawText.length)
      console.log('Raw text preview:', rawText.substring(0, 300) + '...')

      // ENHANCED: Apply comprehensive text cleaning for COA documents
      const cleanedText = this.cleanOCRTextForCOA(rawText)
      
      console.log('Cleaned text length:', cleanedText.length)
      console.log('Cleaned text preview:', cleanedText.substring(0, 300) + '...')

      // Calculate confidence based on response and text characteristics
      const confidence = this.estimateConfidence(cleanedText, ocrResponse)
      
      // Extract metadata
      const metadata = this.extractMetadata(cleanedText, ocrResponse)

      return {
        success: true,
        extractedText: cleanedText, // Return the cleaned text
        confidence,
        processingTime: Date.now() - startTime,
        provider: 'mistral-ocr',
        metadata
      }

    } catch (error) {
      console.error('Mistral OCR processing error:', error)
      
      return {
        success: false,
        extractedText: '',
        processingTime: Date.now() - startTime,
        provider: 'mistral-ocr',
        error: error instanceof Error ? error.message : 'Unknown OCR error'
      }
    }
  }

  private async encodePdf(pdfPath: string): Promise<string> {
    try {
      // Read the PDF file as a buffer
      const pdfBuffer = fs.readFileSync(pdfPath)
      
      // Convert the buffer to a Base64-encoded string
      const base64Pdf = pdfBuffer.toString('base64')
      
      console.log('PDF encoded successfully, size:', base64Pdf.length, 'characters')
      return base64Pdf
    } catch (error) {
      console.error('Error encoding PDF:', error)
      throw new Error(`Failed to encode PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private extractTextFromResponse(ocrResponse: any): string {
    try {
      console.log('OCR Response structure keys:', Object.keys(ocrResponse || {}))
      
      // Check for the pages structure first (this is what Mistral OCR returns)
      if (ocrResponse.pages && Array.isArray(ocrResponse.pages)) {
        const allMarkdown = ocrResponse.pages
          .map((page: any, index: number) => {
            if (page.markdown) {
              return `=== PAGE ${index + 1} ===\n${page.markdown}`
            }
            return ''
          })
          .filter(text => text.length > 0)
          .join('\n\n')
        
        if (allMarkdown.length > 0) {
          console.log('Successfully extracted text from pages.markdown')
          return allMarkdown
        }
      }
      
      // Fallback checks for other possible structures
      if (typeof ocrResponse === 'string') {
        return ocrResponse
      }
      
      if (ocrResponse.text) {
        return ocrResponse.text
      }
      
      if (ocrResponse.content) {
        if (typeof ocrResponse.content === 'string') {
          return ocrResponse.content
        }
        if (Array.isArray(ocrResponse.content)) {
          return ocrResponse.content.map((item: any) => {
            if (typeof item === 'string') return item
            if (item.text) return item.text
            if (item.content) return item.content
            return ''
          }).join('\n')
        }
      }
      
      if (ocrResponse.data && ocrResponse.data.text) {
        return ocrResponse.data.text
      }
      
      // If we can't find text in expected places, log the full structure
      console.warn('Could not find text in expected OCR response structure')
      console.warn('Available keys:', Object.keys(ocrResponse || {}))
      if (ocrResponse.pages) {
        console.warn('Pages structure:', ocrResponse.pages.map((p: any) => Object.keys(p)))
      }
      
      return ''
      
    } catch (error) {
      console.error('Error extracting text from OCR response:', error)
      return ''
    }
  }

  // NEW: Comprehensive text cleaning specifically for COA documents
  private cleanOCRTextForCOA(text: string): string {
    console.log('Starting comprehensive OCR text cleaning...')
    
    let cleaned = text

    // 1. MARKDOWN CLEANING - Remove markdown formatting that might interfere
    cleaned = cleaned
      .replace(/\*\*(.*?)\*\*/g, '$1')           // Remove bold markdown **text**
      .replace(/\*(.*?)\*/g, '$1')               // Remove italic markdown *text*
      .replace(/`(.*?)`/g, '$1')                 // Remove code markdown `text`
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')       // Remove markdown links [text](url)
      .replace(/^\s*[\|\-\+\=\s]+$/gm, '')      // Remove table separators
      .replace(/^\s*\|/gm, '')                  // Remove table pipe starts
      .replace(/\|\s*$/gm, '')                  // Remove table pipe ends

    // 2. COMMON OCR CHARACTER FIXES - Critical for numbers and percentages
    cleaned = cleaned
      // Character substitutions that affect numbers
      .replace(/\bO\b/g, '0')                   // Standalone O -> 0
      .replace(/(?<=\d)O(?=\d)/g, '0')          // O between digits -> 0
      .replace(/(?<=\d)o(?=\d)/g, '0')          // o between digits -> 0
      .replace(/\bl\b/g, '1')                   // Standalone l -> 1
      .replace(/(?<=\d)l(?=\d)/g, '1')          // l between digits -> 1
      .replace(/(?<=\d)I(?=\d)/g, '1')          // I between digits -> 1
      .replace(/\bS\b(?=\d)/g, '5')             // S before digits -> 5
      .replace(/(?<=\d)S\b/g, '5')              // S after digits -> 5
      .replace(/\bZ\b(?=\d)/g, '2')             // Z before digits -> 2
      .replace(/(?<=\d)Z(?=\.)/g, '2')          // Z before decimal -> 2
      .replace(/\|(?=\d)/g, '1')                // | before digits -> 1
      .replace(/(?<=\d)\|/g, '1')               // | after digits -> 1

    // 3. DECIMAL POINT FIXES
    cleaned = cleaned
      .replace(/(\d)\s*\,\s*(\d)/g, '$1.$2')    // Fix comma decimals: 24,2 -> 24.2
      .replace(/(\d)\s*;\s*(\d)/g, '$1.$2')     // Fix semicolon decimals: 24;2 -> 24.2
      .replace(/(\d)\s+(\d{1,4})\s*%/g, '$1.$2%') // Fix spaced decimals: 24 2% -> 24.2%

    // 4. PERCENTAGE SYMBOL FIXES
    cleaned = cleaned
      .replace(/(\d+\.?\d*)\s*\/o/gi, '$1%')    // /o -> %
      .replace(/(\d+\.?\d*)\s*°\/o/gi, '$1%')   // °/o -> %
      .replace(/(\d+\.?\d*)\s*º/gi, '$1%')      // º -> %
      .replace(/(\d+\.?\d*)\s*°/gi, '$1%')      // ° -> %
      .replace(/(\d+\.?\d*)\s*％/gi, '$1%')      // Full-width % -> %

    // 5. SPACING NORMALIZATION - Critical for regex matching
    cleaned = cleaned
      .replace(/\s+/g, ' ')                     // Multiple spaces -> single space
      .replace(/(\w)\s*:\s*(\w)/g, '$1: $2')    // Normalize colons: "THC:24" -> "THC: 24"
      .replace(/(\d+\.?\d*)\s*%/g, '$1%')       // Remove space before %
      .replace(/THC\s+:/gi, 'THC:')             // "THC :" -> "THC:"
      .replace(/CBD\s+:/gi, 'CBD:')             // "CBD :" -> "CBD:"
      .replace(/TOTAL\s+THC/gi, 'TOTAL THC')    // Normalize "TOTAL THC"
      .replace(/TOTAL\s+CBD/gi, 'TOTAL CBD')    // Normalize "TOTAL CBD"
      .replace(/TOTAL\s+CANNABINOIDS/gi, 'TOTAL CANNABINOIDS')

    // 6. CANNABINOID LABEL FIXES - Fix common OCR errors in labels
    cleaned = cleaned
      .replace(/TH[CG]/gi, 'THC')               // THG -> THC
      .replace(/CB[DO]/gi, 'CBD')               // CBO -> CBD
      .replace(/CANN[AI]BINOIDS/gi, 'CANNABINOIDS') // Fix A/I confusion
      .replace(/CANNABIN[O0]IDS/gi, 'CANNABINOIDS') // Fix O/0 confusion

    // 7. STRUCTURAL IMPROVEMENTS
    cleaned = cleaned
      .replace(/^\s*PAGE\s+\d+\s*$/gim, '')     // Remove page markers
      .replace(/=+\s*PAGE\s+\d+\s*=+/gi, '')    // Remove page separators
      .replace(/\n\s*\n\s*\n/g, '\n\n')         // Reduce excessive line breaks
      .trim()

    // 8. LOG SPECIFIC IMPROVEMENTS MADE
    const improvements = []
    
    if (text !== cleaned) {
      if (text.includes('**') || text.includes('*')) improvements.push('markdown removal')
      if (/\bO\b|\bl\b/.test(text)) improvements.push('character substitution')
      if (/\d\s*,\s*\d/.test(text)) improvements.push('decimal fixes')
      if (/\s+/.test(text)) improvements.push('spacing normalization')
      
      console.log('OCR cleaning improvements applied:', improvements.join(', '))
      console.log('Text length change:', text.length, '->', cleaned.length)
      
      // Show examples of key fixes
      const thcBefore = text.match(/TH[CG]\s*:?\s*\d+[.,]?\d*\s*[%°º]/gi) || []
      const thcAfter = cleaned.match(/THC\s*:?\s*\d+\.?\d*%/gi) || []
      if (thcBefore.length > 0 || thcAfter.length > 0) {
        console.log('THC pattern improvements:')
        console.log('Before:', thcBefore.slice(0, 3))
        console.log('After:', thcAfter.slice(0, 3))
      }

      const cbdBefore = text.match(/CB[DO]\s*:?\s*\d+[.,]?\d*\s*[%°º]/gi) || []
      const cbdAfter = cleaned.match(/CBD\s*:?\s*\d+\.?\d*%/gi) || []
      if (cbdBefore.length > 0 || cbdAfter.length > 0) {
        console.log('CBD pattern improvements:')
        console.log('Before:', cbdBefore.slice(0, 3))
        console.log('After:', cbdAfter.slice(0, 3))
      }
    }

    return cleaned
  }

  private estimateConfidence(text: string, ocrResponse: any): number {
    let confidence = 80 // Base confidence for Mistral OCR

    // Boost confidence based on COA-specific content
    if (text.toLowerCase().includes('certificate of analysis')) confidence += 10
    if (text.toLowerCase().includes('certificate')) confidence += 5
    if (text.includes('%')) confidence += 5 // Percentages common in COAs
    if (text.match(/\d+\.\d+/)) confidence += 5 // Decimal numbers
    if (text.toLowerCase().includes('thc')) confidence += 5
    if (text.toLowerCase().includes('cbd')) confidence += 3
    if (text.toLowerCase().includes('terpene')) confidence += 3
    if (text.toLowerCase().includes('batch')) confidence += 3
    if (text.toLowerCase().includes('lab')) confidence += 2

    // ENHANCED: Check for clean cannabinoid patterns after our cleaning
    const cleanThcPatterns = text.match(/TOTAL\s+THC\s*:\s*\d+\.?\d*%/gi) || []
    const cleanCbdPatterns = text.match(/TOTAL\s+CBD\s*:\s*\d+\.?\d*%/gi) || []
    const cleanTotalPatterns = text.match(/TOTAL\s+CANNABINOIDS\s*:\s*\d+\.?\d*%/gi) || []
    
    if (cleanThcPatterns.length > 0) confidence += 10
    if (cleanCbdPatterns.length > 0) confidence += 8
    if (cleanTotalPatterns.length > 0) confidence += 8
    
    console.log('Found clean patterns:', {
      thc: cleanThcPatterns.length,
      cbd: cleanCbdPatterns.length,
      total: cleanTotalPatterns.length
    })
    
    // Text quality indicators
    if (text.length > 500) confidence += 3
    if (text.length > 1000) confidence += 3
    if (text.length > 2000) confidence += 2
    
    // Structure indicators
    if (text.includes('\n')) confidence += 2 // Has line breaks
    if (text.match(/[A-Z]{2,}/)) confidence += 2 // Has uppercase words
    
    // Check if OCR response includes confidence scores
    if (ocrResponse && ocrResponse.confidence) {
      confidence = Math.min(confidence, ocrResponse.confidence * 100)
    }
    
    // Reduce confidence for potential issues
    if (text.includes('�')) confidence -= 10 // Replacement characters
    
    // Check for garbled text - be more lenient after cleaning
    const standardChars = text.match(/[a-zA-Z0-9\s\.\-\%\(\)\:\,\/\n]/g) || []
    const standardRatio = standardChars.length / text.length
    if (standardRatio < 0.75) confidence -= 15 // Slightly more lenient threshold

    return Math.min(Math.max(confidence, 35), 95) // Clamp between 35-95
  }

  private extractMetadata(text: string, ocrResponse: any) {
    // Extract metadata from OCR response if available
    let pageCount = 1
    let hasImages = false
    
    if (ocrResponse) {
      if (ocrResponse.pages) {
        pageCount = ocrResponse.pages.length || 1
      }
      if (ocrResponse.images && ocrResponse.images.length > 0) {
        hasImages = true
      }
    }
    
    // Detect page count from text if not in response
    const pageIndicators = text.match(/page\s+\d+/gi) || []
    if (pageIndicators.length > 0) {
      pageCount = Math.max(pageCount, pageIndicators.length)
    }

    return {
      pageCount,
      hasImages,
      hasTables: this.detectTables(text),
      language: 'en' // Assume English for COAs
    }
  }

  private detectTables(text: string): boolean {
    // Enhanced table detection
    const lines = text.split('\n')
    let tableRowCount = 0
    
    for (const line of lines) {
      // Look for lines with multiple spaced values (table rows)
      if (line.match(/\s+\d+\.\d+\s+/) || // Numbers with decimals
          line.match(/\s+\w+\s+\w+\s+/) ||  // Multiple words spaced
          line.includes('\t') ||             // Tab characters
          line.match(/\d+\.?\d*%\s+\d+\.?\d*\s*(mg|ppm)/)) { // COA-style data rows
        tableRowCount++
      }
    }
    
    return tableRowCount > 3 // Lower threshold since we might have fewer but important rows
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Test the API key by making a simple request using the stored apiKey
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        }
      })
      return response.ok
    } catch (error) {
      console.error('Mistral API key validation failed:', error)
      return false
    }
  }
}

// Singleton instance
let mistralOCRInstance: MistralOCRService | null = null

export function getMistralOCRService(): MistralOCRService {
  if (!mistralOCRInstance) {
    mistralOCRInstance = new MistralOCRService()
  }
  return mistralOCRInstance
}

// Convenience function for processing documents
export async function processPDFWithMistral(filePath: string): Promise<OCRResult> {
  const service = getMistralOCRService()
  return service.processDocument(filePath)
}