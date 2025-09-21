import { processPDFWithMistral, OCRResult } from './mistralOCR'
import { extractWithPdfParse } from './fallbackOCR'

export interface OCRConfig {
  preferredProvider: 'mistral' | 'pdf-parse' | 'auto'
  enableFallback: boolean
  minConfidence: number
  retryAttempts: number
}

const DEFAULT_CONFIG: OCRConfig = {
  preferredProvider: 'mistral',
  enableFallback: true,
  minConfidence: 60,
  retryAttempts: 2
}

export class OCRService {
  private config: OCRConfig

  constructor(config: Partial<OCRConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async processDocument(filePath: string): Promise<OCRResult> {
    let result: OCRResult
    let attempts = 0

    // Try primary provider
    while (attempts < this.config.retryAttempts) {
      attempts++
      
      try {
        if (this.config.preferredProvider === 'mistral') {
          result = await processPDFWithMistral(filePath)
        } else {
          result = await extractWithPdfParse(filePath)
        }

        // Check if result meets quality requirements
        if (result.success && (result.confidence || 0) >= this.config.minConfidence) {
          return result
        }

        console.log(`OCR attempt ${attempts} failed or low confidence:`, {
          success: result.success,
          confidence: result.confidence,
          provider: result.provider,
          error: result.error
        })

      } catch (error) {
        console.error(`OCR attempt ${attempts} error:`, error)
      }

      // Wait before retry (exponential backoff)
      if (attempts < this.config.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000))
      }
    }

    // If primary provider failed and fallback is enabled
    if (this.config.enableFallback && this.config.preferredProvider !== 'pdf-parse') {
      console.log('Trying fallback OCR provider: pdf-parse')
      
      try {
        result = await extractWithPdfParse(filePath)
        
        if (result.success) {
          return {
            ...result,
            provider: `${result.provider} (fallback)`
          }
        }
      } catch (error) {
        console.error('Fallback OCR failed:', error)
      }
    }

    // Return the last attempt result or a final failure
    return result! || {
      success: false,
      extractedText: '',
      processingTime: 0,
      provider: 'none',
      error: 'All OCR providers failed'
    }
  }

  async validateConfiguration(): Promise<{
    mistralAvailable: boolean
    pdfParseAvailable: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    let mistralAvailable = false
    const pdfParseAvailable = true // pdf-parse is always available

    // Check Mistral API key
    try {
      if (!process.env.MISTRAL_API_KEY) {
        errors.push('MISTRAL_API_KEY not configured')
      } else {
        mistralAvailable = true
      }
    } catch (error) {
      errors.push(`Mistral configuration error: ${error}`)
    }

    return {
      mistralAvailable,
      pdfParseAvailable,
      errors
    }
  }

  updateConfig(newConfig: Partial<OCRConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): OCRConfig {
    return { ...this.config }
  }
}

// Singleton instance
let ocrServiceInstance: OCRService | null = null

export function getOCRService(config?: Partial<OCRConfig>): OCRService {
  if (!ocrServiceInstance) {
    ocrServiceInstance = new OCRService(config)
  } else if (config) {
    ocrServiceInstance.updateConfig(config)
  }
  return ocrServiceInstance
}

// Convenience function
export async function processDocumentOCR(filePath: string): Promise<OCRResult> {
  const service = getOCRService()
  return service.processDocument(filePath)
}