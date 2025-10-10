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

  // One canonical regex for terpene panels; used everywhere
  private readonly TERP_HDR =
    /(?:M[-–—]?0?255S?\b.*TERPENES|TERPENES?\s+BY\s+GC[-–—]?\s*FID|TERPENE\s+PROFILE)/i

  constructor() {
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is required')
    }

    this.client = new Mistral({ apiKey })
    this.maxFileSize = parseInt(process.env.OCR_MAX_FILE_SIZE || '52428800') // 50MB
    this.timeout = parseInt(process.env.OCR_TIMEOUT || '180000') // 3 minutes
  }

  // --- Helpers --------------------------------------------------------------

  private async encodePdf(pdfPath: string): Promise<string> {
    const pdfBuffer = fs.readFileSync(pdfPath)
    const base64Pdf = pdfBuffer.toString('base64')
    console.log('PDF encoded successfully, size:', base64Pdf.length, 'characters')
    return base64Pdf
  }

  private extractTextFromResponse(ocrResponse: any): string {
  try {
    if (ocrResponse?.pages && Array.isArray(ocrResponse.pages)) {
      const allMarkdown = ocrResponse.pages
        .map((page: any, index: number) =>
          page?.markdown ? `=== PAGE ${index + 1} ===\n${page.markdown}` : ''
        )
        .filter(Boolean)
        .join('\n\n')
      
      if (allMarkdown.length) {
        // ADD DIAGNOSTIC LOGGING HERE
        console.log('🔍🔍🔍 EXTRACTED TEXT SAMPLE (terpene area):')
        const terpIdx = allMarkdown.search(/TERPENES?\s+BY\s+GC/i)
        console.log('Terpene search index:', terpIdx)
        if (terpIdx >= 0) {
          console.log('=== RAW MARKDOWN TERPENE SECTION ===')
          console.log(allMarkdown.substring(terpIdx, terpIdx + 1200))
          console.log('=== END RAW MARKDOWN SECTION ===')
        } else {
          console.log('❌ No terpene section found in extracted markdown')
        }
        
        return allMarkdown
      }
    }
    if (typeof ocrResponse === 'string') return ocrResponse
    if (ocrResponse?.text) return ocrResponse.text
    if (ocrResponse?.content) {
      if (typeof ocrResponse.content === 'string') return ocrResponse.content
      if (Array.isArray(ocrResponse.content)) {
        return ocrResponse.content
          .map((it: any) => (typeof it === 'string' ? it : (it.text || it.content || '')))
          .join('\n')
      }
    }
    if (ocrResponse?.data?.text) return ocrResponse.data.text
    console.warn('Could not find text in expected OCR response structure')
    return ''
  } catch {
    return ''
  }
  }

  // Keep table characters; only normalize numbers/spacing.
  private cleanOCRTextForCOA(text: string): string {
  console.log('Starting comprehensive OCR text cleaning...')
  let cleaned = text

  // 0) Fix character splitting artifacts: "*M* *O* *U* *N* *T*" -> "MOUNT"
  cleaned = cleaned.replace(/\*([A-Z0-9])\*\s*/gi, '$1')

  // 1) Markdown cleanup - remove formatting but keep structure
  cleaned = cleaned
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
    .replace(/\*(.*?)\*/g, '$1')      // Italic
    .replace(/`(.*?)`/g, '$1')        // Code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links

  // 2) Number and character fixes
  cleaned = cleaned
    .replace(/(\d)\s*,\s*(\d)/g, '$1.$2')        // 24,2 -> 24.2
    .replace(/(\d)\s*;\s*(\d)/g, '$1.$2')        // 24;2 -> 24.2
    .replace(/(\d+)\s+(\d{1,4})\s*%/g, '$1.$2%') // 24 2% -> 24.2%
    .replace(/(\d+\.?\d*)\s*[%º°]/g, '$1%')      // Normalize percent symbols
    .replace(/TH[CG]/gi, 'THC')                  // THG/THC typos
    .replace(/CB[DO]/gi, 'CBD')                  // CBO/CBD typos
    .replace(/TOTAL\s+THC/gi, 'TOTAL THC')
    .replace(/TOTAL\s+CBD/gi, 'TOTAL CBD')
    .replace(/TOTAL\s+CANNABIN(O|0)IDS/gi, 'TOTAL CANNABINOIDS')
    
  // 3) CRITICAL: Keep Greek letters - don't convert to ASCII
  // This preserves the original characters for terpene matching
  // The conversion will happen in normalizeTerpName() if needed

  // 4) Preserve table structure - only normalize EXCESSIVE whitespace
  // This is critical for terpene table parsing
  cleaned = cleaned
    .replace(/[ \t]{3,}/g, '  ')    // 3+ spaces -> 2 spaces (keeps columns aligned)
    .replace(/\r\n/g, '\n')         // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')     // Max 2 consecutive newlines

  // 5) Ensure clean breaks before page headers to help section slicing
  cleaned = cleaned.replace(/=== PAGE/g, '\n=== PAGE')

  // 6) Log sample for debugging
  const sample = cleaned.substring(0, 500)
  console.log('Cleaned text sample:', sample)
  console.log('Contains Greek β:', /β/.test(cleaned))
  console.log('Contains Greek α:', /α/.test(cleaned))
  console.log('Text length after cleaning:', cleaned.length)

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

  private detectTables(text: string): boolean {
    const lines = text.split('\n')
    let rows = 0
    for (const l of lines) {
      if (/\s+\d+\.?\d+\s+(%|mg\/g)/i.test(l) || /\|/.test(l)) rows++
    }
    return rows > 3
  }

  private extractMetadata(text: string, ocrResponse: any) {
    const pageCount = ocrResponse?.pages?.length || 1
    const hasImages =
      !!(ocrResponse as any)?.images?.length ||
      !!(ocrResponse as any)?.pages?.some((p: any) => p?.images?.length || p?.imageBase64s?.length || p?.imageBase64)
    return { pageCount, hasImages, hasTables: this.detectTables(text), language: 'en' }
  }

  // Image OCR ---------------------------------------------------------------

  private async ocrBase64Image(imgB64: string): Promise<string> {
    try {
      const resp = await this.client.ocr.process({
        model: 'mistral-ocr-latest',
        document: { type: 'document_url', documentUrl: `data:image/jpeg;base64,${imgB64}` },
        includeImageBase64: false
      })
      if (resp?.pages?.length) {
        return resp.pages.map((p: any) => p?.markdown || p?.text || '').join('\n')
      }
      return (resp as any)?.text || ''
    } catch (e) {
      console.warn('image OCR failed:', e)
      return ''
    }
  }

  private pageImageBase64s(page: any): string[] {
    if (!page) return []
    if (Array.isArray(page.images)) {
      return page.images.map((img: any) => img?.base64 || img?.data || '').filter(Boolean)
    }
    if (Array.isArray(page.imageBase64s)) return page.imageBase64s.filter(Boolean)
    if (typeof page.imageBase64 === 'string') return [page.imageBase64]
    return []
  }

  // Stitch text from image-only pages or pages that look like terpene panel
 private async appendImageOnlyPageText(ocrResponse: any, currentMarkdown: string): Promise<string> {
  const resp = ocrResponse as any
  if (!resp?.pages?.length) return currentMarkdown

  let combined = currentMarkdown

  for (let i = 0; i < resp.pages.length; i++) {
    const page = resp.pages[i]
    const md = page?.markdown || ''
    
    // ENHANCED: More aggressive image detection
    const isImagePlaceholder = /!\[img[^\]]*\]/i.test(md)
    const hasMinimalText = md.trim().length < 200
    const pageHasTerpHeader = this.TERP_HDR.test(md)
    const hasPercentages = /\d+\.\d+\s*%/.test(md)
    const terpHeaderWithoutData = pageHasTerpHeader && !hasPercentages
    const looksImageOnly = !/[A-Z]{3,}/.test(md) || isImagePlaceholder
    const hasWeirdSpacing = /\*[A-Z]\*\s*\*[A-Z]\*/i.test(md) // Detects "*M* *O* *U*" pattern
    
    // CRITICAL: Always OCR pages 1-2 since terpenes are usually there
    const shouldOCR = i < 2 || 
                  terpHeaderWithoutData || 
                  isImagePlaceholder || 
                  hasMinimalText || 
                  looksImageOnly || 
                  hasWeirdSpacing
                  
    // ADD THIS DEBUG SECTION ⬇️⬇️⬇️
    console.log(`\n=== PAGE ${i + 1} IMAGE OCR CHECK ===`)
    console.log('Page index:', i)
    console.log('Should OCR?', shouldOCR)
    console.log('Reasons:')
    console.log('  - First 2 pages (i < 2):', i < 2)
    console.log('  - Terpene header without data:', terpHeaderWithoutData)
    console.log('  - Is image placeholder:', isImagePlaceholder)
    console.log('  - Has minimal text:', hasMinimalText)
    console.log('  - Looks image only:', looksImageOnly)
    console.log('  - Has weird spacing:', hasWeirdSpacing)
    
    const imgs = this.pageImageBase64s(page)
    console.log('Images available:', imgs.length)
    console.log('=== END PAGE CHECK ===\n')
    // END DEBUG SECTION ⬆️⬆️⬆️              
    
    if (shouldOCR) {
      const imgs = this.pageImageBase64s(page)
      if (imgs.length > 0) {
        console.log(`🖼️  Page ${i + 1}: Running image OCR (reason: ${
          terpHeaderWithoutData ? 'terpene header without data' :
          i < 2 ? 'first 2 pages' :
          isImagePlaceholder ? 'image placeholder' :
          'other'
        })`)
        
        for (const b64 of imgs) {
          const imgText = await this.ocrBase64Image(b64)
          if (imgText && imgText.trim().length > 50) {
            combined += `\n\n=== PAGE ${i + 1} IMAGE OCR ===\n${imgText}`
            console.log(`✅ Extracted ${imgText.length} chars from page ${i + 1}`)
            
            // ADD THIS SECTION HERE ⬇️⬇️⬇️
            // Verify we got actual data with percentages
            const imgHasPercentages = /\d+\.\d+\s*%/.test(imgText)
            const imgHasTerpHeader = this.TERP_HDR.test(imgText)
            
            if (imgHasTerpHeader && imgHasPercentages) {
              console.log(`🌿 SUCCESS: Terpene data with percentages found in image OCR!`)
            } else if (imgHasTerpHeader && !imgHasPercentages) {
              console.log(`⚠️  WARNING: Terpene header found but still no percentage data`)
            }
            // END NEW SECTION ⬆️⬆️⬆️
          }
        }
      } else {
        console.log(`⚠️  Page ${i + 1} flagged for OCR but no images available`)
        console.log(`     Markdown preview: ${md.substring(0, 150)}`)
      }
    }
  }
  
  if (combined.length > currentMarkdown.length) {
    console.log(`📊 Image OCR added ${combined.length - currentMarkdown.length} chars`)
  }
  
  return combined
}

  // --- Public: main entry ---------------------------------------------------

  async processDocument(filePath: string): Promise<OCRResult> {
    const startTime = Date.now()

    try {
      console.log('Starting Mistral OCR processing for:', filePath)

      // Validate file exists / size
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

      // Encode PDF
      console.log('Encoding PDF to base64...')
      const base64Pdf = await this.encodePdf(filePath)

      // OCR PDF (request page images too)
      console.log('Processing with Mistral OCR API...')
      const ocrResponse = await Promise.race([
        this.client.ocr.process({
          model: 'mistral-ocr-latest',
          document: { type: 'document_url', documentUrl: `data:application/pdf;base64,${base64Pdf}` },
          includeImageBase64: true
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('OCR processing timeout')), this.timeout)
        )
      ])

      console.log('OCR processing completed successfully')

      // Quick per-page preview
      if ((ocrResponse as any)?.pages?.length) {
        const resp = ocrResponse as any
        console.log(`Mistral returned ${resp.pages.length} pages`)
        resp.pages.forEach((p: any, i: number) => {
          const md = (p?.markdown || '').slice(0, 250).replace(/\n/g, ' ')
          console.log(`Page ${i + 1} md preview:`, md)
          if (this.TERP_HDR.test(p?.markdown || '')) {
            console.log(`✅ Page ${i + 1} looks like terpene panel (M-0255 / TERPENES BY GC-FID).`)
          }
        })
      }

      // Extract text from response
      const rawText = this.extractTextFromResponse(ocrResponse)
      if (!rawText || rawText.trim().length === 0) {
        throw new Error('No text could be extracted from the document')
      }

      console.log('🔍 CHECKING RAW OCR FOR TERPENES...')
      const rawTerpIdx = rawText.search(this.TERP_HDR)
      console.log('Raw terpene header index:', rawTerpIdx)
      if (rawTerpIdx >= 0) {
        console.log('=== RAW OCR TERPENE SECTION (BEFORE CLEANING) ===')
        console.log(rawText.substring(rawTerpIdx, rawTerpIdx + 1500))
        console.log('=== END RAW SECTION ===')
      } else {
        console.log('❌ No terpene header in raw OCR')
      }

      console.log('Raw extracted text length:', rawText.length)
      console.log('=== DIAGNOSTIC: RAW OCR TEXT (first 1200 chars) ===')
      console.log(rawText.substring(0, 1200))
      console.log('Terpene hdr present? ', this.TERP_HDR.test(rawText))

      // Stitch any image-only pages (esp. terpene table) into the text
      const rawPlusImages = await this.appendImageOnlyPageText(ocrResponse, rawText)
      if (rawPlusImages.length !== rawText.length) {
        console.log(`Appended image OCR text: ${rawText.length} -> ${rawPlusImages.length} chars`)
      }

      // Clean (keep tables)
      const cleanedText = this.cleanOCRTextForCOA(rawPlusImages)
      console.log('Cleaned text length:', cleanedText.length)
      console.log('Cleaned contains terpene header?', this.TERP_HDR.test(cleanedText))

      // Log the slice around the terpene panel if present
      const terpStart = cleanedText.search(this.TERP_HDR)
      if (terpStart >= 0) {
        const panelPreview = cleanedText.slice(terpStart, terpStart + 1500)
        console.log('=== TERPENE PANEL SLICE (first 1500 chars) ===\n', panelPreview)
      } else {
        console.log('No terpene header found even after image OCR stitching.')
      }

      // Score & metadata
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

  // --- Misc -----------------------------------------------------------------

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` }
      })
      return response.ok
    } catch {
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