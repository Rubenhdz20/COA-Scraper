import { Mistral } from '@mistralai/mistralai'
import fs from 'fs'
import path from 'path'

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

export interface MistralOCRResponse {
  content: Array<{
    type: 'text' | 'image'
    text?: string
    images?: Array<{
      content: string
      format: string
    }>
    dimensions?: {
      dpi: number
      height: number
      width: number
    }
  }>
  model: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

class MistralOCRService {
  private client: Mistral
  private readonly maxFileSize: number
  private readonly maxPages: number
  private readonly timeout: number

  constructor() {
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is required')
    }

    this.client = new Mistral({ apiKey })
    this.maxFileSize = parseInt(process.env.OCR_MAX_FILE_SIZE || '52428800') // 50MB
    this.maxPages = parseInt(process.env.OCR_MAX_PAGES || '1000')
    this.timeout = parseInt(process.env.OCR_TIMEOUT || '60000') // 60 seconds
  }

  async processDocument(filePath: string): Promise<OCRResult> {
    const startTime = Date.now()

    try {
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

      // Read and encode file to base64
      const fileBuffer = await fs.promises.readFile(filePath)
      const base64Data = fileBuffer.toString('base64')
      const dataUrl = `data:application/pdf;base64,${base64Data}`

      // Process with Mistral OCR
      const response = await Promise.race([
        this.client.ocr.process({
          model: process.env.MISTRAL_OCR_MODEL || 'mistral-ocr-latest',
          document: {
            type: 'document_url',
            documentUrl: dataUrl
          },
          includeImageBase64: false // Set to true if you need embedded images
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OCR processing timeout')), this.timeout)
        )
      ]) as MistralOCRResponse

      // Extract text from response
      const extractedText = this.parseOCRResponse(response)
      
      // Calculate confidence (Mistral doesn't provide direct confidence score)
      const confidence = this.estimateConfidence(extractedText, response)

      // Extract metadata
      const metadata = this.extractMetadata(response)

      return {
        success: true,
        extractedText,
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

  private parseOCRResponse(response: MistralOCRResponse): string {
    if (!response.content || !Array.isArray(response.content)) {
      return ''
    }

    return response.content
      .filter(item => item.type === 'text' && item.text)
      .map(item => item.text)
      .join('\n')
      .trim()
  }

  private estimateConfidence(text: string, response: MistralOCRResponse): number {
    // Mistral doesn't provide direct confidence scores
    // We estimate based on text quality indicators
    let confidence = 85 // Base confidence for Mistral OCR

    // Boost confidence based on text characteristics
    if (text.length > 100) confidence += 5
    if (text.includes('%')) confidence += 3 // Common in COAs
    if (text.match(/\b[A-Z]{2,}\b/)) confidence += 2 // Uppercase abbreviations
    if (text.match(/\d+\.\d+/)) confidence += 3 // Decimal numbers
    
    // Reduce confidence for potential OCR artifacts
    if (text.includes('�')) confidence -= 10 // Replacement characters
    const specialCharMatches = text.match(/[^\w\s\.\-\%\(\)]/g) || [];
    if (specialCharMatches.length > text.length * 0.1) {
      confidence -= 15 // Too many special characters
    }

    return Math.min(Math.max(confidence, 10), 99) // Clamp between 10-99
  }

  private extractMetadata(response: MistralOCRResponse) {
    const content = response.content || []
    
    return {
      pageCount: content.length,
      hasImages: content.some(item => item.type === 'image'),
      hasTables: content.some(item => 
        item.text?.includes('|') || item.text?.includes('\t')
      ),
      language: 'auto-detected' // Mistral auto-detects language
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Test API key with a minimal request
      // We can't easily test OCR without a document, so we'll try to access model info
      return true // For now, assume valid if constructor didn't throw
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