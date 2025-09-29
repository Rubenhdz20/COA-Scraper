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
    this.timeout = parseInt(process.env.OCR_TIMEOUT || '180000') // 3 minutes
  }

  async processDocument(filePath: string): Promise<OCRResult> {
    const startTime = Date.now()

    try {
      console.log('Starting Mistral OCR processing for:', filePath)

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

      console.log('Encoding PDF to base64...')
      const base64Pdf = await this.encodePdf(filePath)
      
      console.log('Processing with Mistral OCR API...')
      const ocrResponse: any = await Promise.race([
        this.client.ocr.process({
          model: "mistral-ocr-latest",
          document: { type: "document_url", documentUrl: `data:application/pdf;base64,${base64Pdf}` },
          includeImageBase64: true // <- important; helps the model keep table pages
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('OCR processing timeout')), this.timeout))
      ])

      console.log('OCR processing completed successfully')

      // Per-page visibility: make sure terpene page exists in OCR output
      if (ocrResponse?.pages?.length) {
        console.log(`Mistral returned ${ocrResponse.pages.length} pages`)
        ocrResponse.pages.forEach((p: any, i: number) => {
          const md = (p.markdown || '').slice(0, 250).replace(/\n/g, ' ')
          console.log(`Page ${i+1} md preview:`, md)
          if (/M-0?255|TERPENES?\s+BY\s+GC-?FID|TERPENE\s+PROFILE/i.test(p.markdown || '')) {
            console.log(`✅ Page ${i+1} looks like terpene panel (M-0255 / TERPENES BY GC-FID).`)
          }
        })
      }

      const rawText = this.extractTextFromResponse(ocrResponse)
      if (!rawText || rawText.trim().length === 0) {
        throw new Error('No text could be extracted from the document')
      }

      console.log('Raw extracted text length:', rawText.length)
      console.log('=== DIAGNOSTIC: RAW OCR TEXT (first 1200 chars) ===')
      console.log(rawText.substring(0, 1200))
      console.log('Terpene hdr present? ', /M-0?255|TERPENES?\s+BY\s+GC-?FID|TERPENE\s+PROFILE/i.test(rawText))

      // Clean, but KEEP table content; do not strip pipes/rows.
      const cleanedText = this.cleanOCRTextForCOA(rawText)
      console.log('Cleaned text length:', cleanedText.length)
      console.log('Cleaned contains terpene header?', /M-0?255|TERPENES?\s+BY\s+GC-?FID|TERPENE\s+PROFILE/i.test(cleanedText))

      const confidence = this.estimateConfidence(cleanedText, ocrResponse)
      const metadata = this.extractMetadata(cleanedText, ocrResponse)

      return {
        success: true,
        extractedText: cleanedText,
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
      const pdfBuffer = fs.readFileSync(pdfPath)
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
      if (ocrResponse?.pages && Array.isArray(ocrResponse.pages)) {
        const allMarkdown = ocrResponse.pages
          .map((page: any, index: number) => page.markdown ? `=== PAGE ${index + 1} ===\n${page.markdown}` : '')
          .filter(Boolean)
          .join('\n\n')
        if (allMarkdown.length) return allMarkdown
      }
      if (typeof ocrResponse === 'string') return ocrResponse
      if (ocrResponse?.text) return ocrResponse.text
      if (ocrResponse?.content) {
        if (typeof ocrResponse.content === 'string') return ocrResponse.content
        if (Array.isArray(ocrResponse.content)) {
          return ocrResponse.content.map((it: any) => (typeof it === 'string' ? it : (it.text || it.content || ''))).join('\n')
        }
      }
      if (ocrResponse?.data?.text) return ocrResponse.data.text
      console.warn('Could not find text in expected OCR response structure')
      return ''
    } catch {
      return ''
    }
  }

  // Keep table characters and line breaks; normalize only what's necessary.
private cleanOCRTextForCOA(text: string): string {
  console.log('Starting comprehensive OCR text cleaning...')

  let cleaned = text

  // 1) Mild markdown cleanup — DO NOT strip table pipes/rows
  cleaned = cleaned
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')

  // 2) Character / label fixes (safe)
  cleaned = cleaned
    .replace(/TH[CG]/gi, 'THC')
    .replace(/CB[DO]/gi, 'CBD')
    .replace(/TOTAL\s+THC/gi, 'TOTAL THC')
    .replace(/TOTAL\s+CBD/gi, 'TOTAL CBD')
    .replace(/TOTAL\s+CANNABIN(O|0)IDS/gi, 'TOTAL CANNABINOIDS')
    .replace(/β/gi, 'BETA-')
    .replace(/α/gi, 'ALPHA-')
    .replace(/γ/gi, 'GAMMA-')
    .replace(/Δ/gi, 'DELTA-')

  // 3) Number / percent fixes
  // 3a) European decimals like 24,2% -> 24.2%
  cleaned = cleaned.replace(/(\d)\s*,\s*(\d)(?=\s*%)/g, '$1.$2')

  // 3b) Spaced decimals like 24 2% -> 24.2% (be conservative: 1–2 digits only)
  cleaned = cleaned.replace(/\b(\d{1,2})\s+(\d{1,2})\s*%/g, '$1.$2%')

  // 3c) Unify percent glyphs (º, °, etc.) but preserve spacing before %
  cleaned = cleaned
    .replace(/(\d+\.?\d*)\s*[º°％]/g, '$1%')
    .replace(/(\d+\.?\d*)\s*%\s*/g, '$1%') // remove extra spaces before/after %

  // 4) LINE-LEVEL whitespace normalization:
  //    collapse spaces/tabs within each line, but KEEP \n intact.
  cleaned = cleaned
    .split('\n')
    .map(line =>
      line
        .replace(/[ \t]+/g, ' ')         // collapse spaces/tabs inside the line
        .replace(/\s*:\s*/g, ': ')       // normalize colons "THC : 24" -> "THC: 24"
        .trimEnd()
    )
    .join('\n')

  // 5) Ensure breaks before page headers (helps section slicing)
  cleaned = cleaned.replace(/(?:\r?\n)?=== PAGE/g, '\n=== PAGE')

  return cleaned.trim()
}

  private estimateConfidence(text: string, ocrResponse: any): number {
    let confidence = 80
    if (/certificate of analysis/i.test(text)) confidence += 10
    if (/%/.test(text)) confidence += 5
    if (/\d+\.\d+/.test(text)) confidence += 5
    if (/thc/i.test(text)) confidence += 5
    if (/cbd/i.test(text)) confidence += 3
    if (/terpene/i.test(text)) confidence += 3
    const cleanThc = text.match(/TOTAL\s+THC\s*:\s*\d+\.?\d*%/i)
    const cleanCbd = text.match(/TOTAL\s+CBD\s*:\s*\d+\.?\d*%/i)
    const cleanTot = text.match(/TOTAL\s+CANNABINOIDS\s*:\s*\d+\.?\d*%/i)
    if (cleanThc) confidence += 10
    if (cleanCbd) confidence += 8
    if (cleanTot) confidence += 8
    if (ocrResponse?.confidence) confidence = Math.min(confidence, ocrResponse.confidence * 100)
    return Math.min(Math.max(confidence, 35), 95)
  }

  private extractMetadata(text: string, ocrResponse: any) {
    const pageCount = ocrResponse?.pages?.length || 1
    const hasImages = !!(ocrResponse?.images?.length)
    return { pageCount, hasImages, hasTables: this.detectTables(text), language: 'en' }
  }

  private detectTables(text: string): boolean {
    const lines = text.split('\n')
    let rows = 0
    for (const l of lines) {
      if (/\s+\d+\.?\d+\s+(%|mg\/g)/i.test(l) || /\|/.test(l)) rows++
    }
    return rows > 3
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

let mistralOCRInstance: MistralOCRService | null = null

export function getMistralOCRService(): MistralOCRService {
  if (!mistralOCRInstance) mistralOCRInstance = new MistralOCRService()
  return mistralOCRInstance
}

export async function processPDFWithMistral(filePath: string): Promise<OCRResult> {
  const service = getMistralOCRService()
  return service.processDocument(filePath)
}