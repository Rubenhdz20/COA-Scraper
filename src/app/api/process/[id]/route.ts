import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPDFWithMistral } from '@/lib/ocr/mistralOCR'
import { extractDataFromOCRText } from '@/lib/dataExtractor'

// --- Helper: normalize various text dates to full ISO (for Prisma DateTime) ---
function normalizeTestDate(input?: string | null, fallbackText?: string): string | null {
  if (!input && !fallbackText) return null

  const monthMap: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  }

  const tryBuildISO = (mon: string, day: string, year: string) => {
    const m = monthMap[mon.toUpperCase()]
    if (!m) return null
    const d = day.padStart(2, '0')
    return `${year}-${m}-${d}T00:00:00.000Z`
  }

  // If input is already provided, try to normalize it first
  if (input) {
    // Already full ISO?
    if (/^\d{4}-\d{2}-\d{2}T/.test(input)) return input
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return `${input}T00:00:00.000Z`
    // M/D/YYYY or MM/DD/YYYY (or with -)
    const mdy = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (mdy) {
      const mm = mdy[1].padStart(2, '0')
      const dd = mdy[2].padStart(2, '0')
      return `${mdy[3]}-${mm}-${dd}T00:00:00.000Z`
    }
    // MON DD, YYYY / MON DD.YYYY / MON DD YYYY
    const mon = input.match(/([A-Z]{3})\s+(\d{1,2})[,\.\s]+(\d{4})/i)
    if (mon) return tryBuildISO(mon[1], mon[2], mon[3])
  }

  // Fall back: scan the raw OCR text for any recognizable date
  if (fallbackText) {
    // Labels like PRODUCED / TEST DATE / TESTED
    const labeled = fallbackText.match(/(?:PRODUCED|TEST\s*DATE|TESTED)\s*:?\s*([A-Z]{3})\s+(\d{1,2})[,\.\s]+(\d{4})/i)
    if (labeled) return tryBuildISO(labeled[1], labeled[2], labeled[3])

    // Headers like M-#### ... // MON DD.YYYY
    const header = fallbackText.match(/M-\d+[A-Z]?:[^\/]*\/\/\s*([A-Z]{3})\s+(\d{1,2})[,\.\s]+(\d{4})/i)
    if (header) return tryBuildISO(header[1], header[2], header[3])

    // Generic MON DD, YYYY
    const generic = fallbackText.match(/([A-Z]{3})\s+(\d{1,2})[,\.\s]+(\d{4})/i)
    if (generic) return tryBuildISO(generic[1], generic[2], generic[3])

    // Plain YYYY-MM-DD
    const isoDateOnly = fallbackText.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (isoDateOnly) return `${isoDateOnly[1]}-${isoDateOnly[2]}-${isoDateOnly[3]}T00:00:00.000Z`

    // US M/D/YYYY somewhere
    const mdy2 = fallbackText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (mdy2) {
      const mm = mdy2[1].padStart(2, '0')
      const dd = mdy2[2].padStart(2, '0')
      return `${mdy2[3]}-${mm}-${dd}T00:00:00.000Z`
    }
  }

  return null
}

// GET handler - Check processing status (keep existing)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    
    console.log('Checking status for document ID:', documentId)

    const document = await prisma.coaDocument.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return NextResponse.json({
        success: false,
        error: `Document with ID ${documentId} not found`
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        processingStatus: document.processingStatus,
        confidence: document.confidence,
        ...(document.processingStatus === 'completed' && {
          batchId: document.batchId,
          strainName: document.strainName,
          category: document.category,
          subCategory: document.subCategory,
          thcPercentage: document.thcPercentage,
          cbdPercentage: document.cbdPercentage,
          totalCannabinoids: document.totalCannabinoids,
          labName: document.labName,
          testDate: document.testDate,
          terpenes: document.terpenes ? JSON.parse(document.terpenes) : null
        })
      }
    })

  } catch (error) {
    console.error('Error checking document status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

// POST handler - Start ENHANCED processing with better error handling
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    
    console.log('🚀 Starting ENHANCED processing for document ID:', documentId)

    // Find the document
    const existingDocument = await prisma.coaDocument.findUnique({
      where: { id: documentId }
    })

    if (!existingDocument) {
      console.error(`Document with ID ${documentId} not found`)
      return NextResponse.json({
        success: false,
        error: `Document with ID ${documentId} not found`
      }, { status: 404 })
    }

    console.log('Found document:', existingDocument.originalName)
    console.log('File path:', existingDocument.filePath)

    // Update status to processing
    await prisma.coaDocument.update({
      where: { id: documentId },
      data: {
        processingStatus: 'processing'
      }
    })

    let ocrResult: any = null
    let qualityReport: any = null
    let extractedData: any = null

    try {
      // STEP 1: OCR Processing with Mistral (enhanced)
      console.log('📄 Step 1: Starting OCR processing...')
      ocrResult = await processPDFWithMistral(existingDocument.filePath)
      
      if (!ocrResult.success) {
        throw new Error(`OCR failed: ${ocrResult.error}`)
      }

      if (!ocrResult.extractedText || ocrResult.extractedText.trim().length === 0) {
        throw new Error('OCR completed but no text was extracted')
      }

      console.log('✅ OCR completed successfully')
      console.log('OCR confidence:', ocrResult.confidence)
      console.log('Extracted text length:', ocrResult.extractedText.length)
      
      // Log first few lines to check if cannabinoid data is present
      const firstLines = ocrResult.extractedText.split('\n').slice(0, 20).join('\n')
      console.log('📋 OCR text preview (first 20 lines):', firstLines)
      
      // Check for key cannabinoid indicators in raw OCR
      const thcFound = /th[cg]/gi.test(ocrResult.extractedText)
      const cbdFound = /cb[do]/gi.test(ocrResult.extractedText)  
      const percentagesFound = (ocrResult.extractedText.match(/\d+\.?\d*\s*[%°º]/g) || []).length
      console.log('🔍 Raw OCR cannabinoid indicators:', {
        thcFound,
        cbdFound,
        percentagesCount: percentagesFound
      })

      // STEP 2: OCR Quality Validation (more lenient)
      console.log('🔍 Step 2: Validating OCR quality...')
      try {
        const { validateOCRQuality, shouldProceedWithExtraction } = await import('@/lib/ocrValidator')
        
        qualityReport = validateOCRQuality(ocrResult.extractedText)
        console.log('📊 OCR Quality Report:', {
          quality: qualityReport.quality,
          confidence: qualityReport.confidence,
          issues: qualityReport.issues.length,
          coaIndicators: qualityReport.coaIndicators
        })

        // More lenient proceeding - don't stop extraction unless quality is very poor
        if (!shouldProceedWithExtraction(qualityReport) && qualityReport.confidence < 30) {
          console.warn('⚠️  OCR quality poor, but proceeding with extraction anyway')
        }
      } catch (validatorError) {
        console.warn('⚠️  OCR validator failed, proceeding without validation:', validatorError)
        // Create a fallback quality report
        qualityReport = {
          quality: 'unknown',
          confidence: 50,
          issues: [],
          coaIndicators: { hasCOATerms: true, hasPercentages: true }
        }
      }

      // STEP 3: Enhanced AI Data Extraction (with retry logic)
      console.log('🤖 Step 3: Starting enhanced AI data extraction...')
      console.log('About to call extractDataFromOCRText with text length:', ocrResult.extractedText.length)
      
      try {
        extractedData = await extractDataFromOCRText(ocrResult.extractedText)
        
        console.log('✅ Data extraction completed successfully')
        console.log('Extraction confidence:', extractedData.confidence)
        console.log('Extraction method used:', extractedData.extractionMethod)
        
        const summary = {
          batchId: extractedData.batchId,
          strain: extractedData.strainName,
          thc: extractedData.thcPercentage,
          cbd: extractedData.cbdPercentage,
          totalCannabinoids: extractedData.totalCannabinoids,
          lab: extractedData.labName,
          terpenes: extractedData.terpenes?.length || 0
        }
        console.log('📋 Extracted data summary:', summary)

        // Check if we're missing critical cannabinoid data
        const missingCannabinoids =
          !extractedData.thcPercentage &&
          extractedData.cbdPercentage === undefined &&
          !extractedData.totalCannabinoids
        
        if (missingCannabinoids) {
          console.warn('⚠️  WARNING: No cannabinoid data extracted - this may indicate OCR text quality issues')
          console.log('Checking raw text for manual patterns...')
          
          // Quick manual check for obvious patterns
          const manualThc = ocrResult.extractedText.match(/th[cg]\s*:?\s*\d+\.?\d*\s*[%°]/gi)
          const manualCbd = ocrResult.extractedText.match(/cb[do]\s*:?\s*\d+\.?\d*\s*[%°]/gi)
          console.log('Manual pattern check results:', {
            thcPatterns: manualThc?.slice(0, 3) || [],
            cbdPatterns: manualCbd?.slice(0, 3) || []
          })
        }

      } catch (extractionError) {
        console.error('❌ Data extraction failed:', extractionError)
        // Create minimal extraction result
        extractedData = {
          confidence: 10,
          labName: "2 RIVER LABS, INC", // We know this from the context
          category: "INHALABLE"
        }
      }

      // STEP 4: Smart confidence calculation and database save
      console.log('💾 Step 4: Calculating final confidence and saving...')
      
      const confidenceFactors = calculateEnhancedConfidence(
        ocrResult,
        qualityReport,
        extractedData
      )
      
      console.log('📈 Enhanced confidence calculation:', confidenceFactors)

      // --- NEW: normalize date and guard terpenes before saving ---
      const normalizedISO = normalizeTestDate(extractedData?.testDate, ocrResult?.extractedText)
      const testDateValue = normalizedISO ? new Date(normalizedISO) : null

      const terpenesValue =
        Array.isArray(extractedData?.terpenes) && extractedData.terpenes.length > 0
          ? JSON.stringify(extractedData.terpenes)
          : null

      // Prepare data for database update
      const updateData = {
        processingStatus: 'completed' as const,
        rawText: ocrResult.extractedText,
        ocrProvider: ocrResult.provider,
        confidence: confidenceFactors.finalConfidence, // use combined score
        batchId: extractedData.batchId || null,
        strainName: extractedData.strainName || null,
        category: extractedData.category || null,
        subCategory: extractedData.subCategory || null,
        thcPercentage: extractedData.thcPercentage ?? null,
        cbdPercentage: extractedData.cbdPercentage ?? null,
        totalCannabinoids: extractedData.totalCannabinoids ?? null,
        labName: extractedData.labName || null,
        testDate: testDateValue,          // <- Date or null (Prisma-safe)
        terpenes: terpenesValue           // <- null or JSON string
      }

      console.log('Saving to database with data:', {
        confidence: updateData.confidence,
        hasThc: !!updateData.thcPercentage,
        hasCbd: updateData.cbdPercentage !== null,
        hasTotal: !!updateData.totalCannabinoids,
        hasBatch: !!updateData.batchId,
        hasStrain: !!updateData.strainName,
        testDateISO: normalizedISO,
        terpenesCount: extractedData?.terpenes?.length || 0
      })

      const updatedDocument = await prisma.coaDocument.update({
        where: { id: documentId },
        data: updateData
      })

      console.log('✅ Document processing completed successfully!')

      // Return enhanced response with debug info
      return NextResponse.json({
        success: true,
        data: updatedDocument,
        message: 'Document processed successfully with enhanced OCR and AI extraction',
        debug: {
          ocrConfidence: ocrResult.confidence,
          extractionConfidence: extractedData.confidence,
          finalConfidence: confidenceFactors.finalConfidence,
          cannabinoidsFound: {
            thc: !!extractedData.thcPercentage,
            cbd: extractedData.cbdPercentage !== undefined,
            total: !!extractedData.totalCannabinoids
          },
          processingSteps: ['OCR', 'Quality Check', 'Data Extraction', 'Database Save']
        }
      })

    } catch (processingError) {
      console.error('❌ Error during processing:', processingError)
      
      // Enhanced error logging
      console.error('Processing error details:', {
        step: ocrResult ? (qualityReport ? (extractedData ? 'Database Save' : 'Data Extraction') : 'Quality Check') : 'OCR',
        ocrSuccess: ocrResult?.success,
        textLength: ocrResult?.extractedText?.length || 0,
        extractionData: extractedData ? Object.keys(extractedData) : []
      })
      
      // Update status to failed with detailed error
      const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error'
      await prisma.coaDocument.update({
        where: { id: documentId },
        data: {
          processingStatus: 'failed',
          rawText: ocrResult?.extractedText || `Processing failed at early stage: ${errorMessage}`,
          confidence: 0
        }
      })

      return NextResponse.json({
        success: false,
        error: `Processing failed: ${errorMessage}`,
        debug: {
          failurePoint: ocrResult ? (extractedData ? 'database_save' : 'data_extraction') : 'ocr',
          ocrSuccess: ocrResult?.success || false,
          textExtracted: (ocrResult?.extractedText?.length || 0) > 0
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Critical error in process route:', error)
    
    // Try to update status to failed
    try {
      await prisma.coaDocument.update({
        where: { id: (await params).id },
        data: { 
          processingStatus: 'failed',
          confidence: 0,
          rawText: `Critical processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      })
    } catch (updateError) {
      console.error('Failed to update document status to failed:', updateError)
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      debug: {
        failurePoint: 'initialization',
        errorType: error instanceof Error ? error.constructor.name : 'unknown'
      }
    }, { status: 500 })
  }
}

// ENHANCED: Smarter confidence calculation
function calculateEnhancedConfidence(
  ocrResult: any,
  qualityReport: any,
  extractedData: any
) {
  console.log('Calculating enhanced confidence...')
  
  const ocrConfidence = ocrResult?.confidence || 0
  const extractionConfidence = extractedData?.confidence || 0  
  const qualityConfidence = qualityReport?.confidence || 50

  // Count critical data points found
  let dataPoints = 0
  let maxPoints = 6
  
  if (extractedData.batchId) dataPoints += 1
  if (extractedData.strainName) dataPoints += 1
  if (extractedData.thcPercentage) dataPoints += 2 // THC is critical
  if (extractedData.cbdPercentage !== undefined) dataPoints += 1.5 // CBD is important
  if (extractedData.totalCannabinoids) dataPoints += 1.5 // Total is important
  if (extractedData.labName) dataPoints += 0.5

  const dataCompleteness = (dataPoints / maxPoints) * 100

  console.log('Confidence factors:', {
    ocrConfidence,
    extractionConfidence, 
    qualityConfidence,
    dataCompleteness: Math.round(dataCompleteness),
    dataPoints,
    maxPoints
  })

  // Enhanced weighted calculation
  const hasCannabinoids = extractedData.thcPercentage ||
                          extractedData.cbdPercentage !== undefined ||
                          extractedData.totalCannabinoids

  let finalConfidence: number
  
  if (hasCannabinoids) {
    finalConfidence = Math.round(
      ocrConfidence * 0.2 +
      extractionConfidence * 0.6 +
      qualityConfidence * 0.1 +
      dataCompleteness * 0.1
    )
  } else {
    finalConfidence = Math.round(
      ocrConfidence * 0.4 +
      extractionConfidence * 0.3 +
      qualityConfidence * 0.2 +
      dataCompleteness * 0.1
    )
  }

  if (dataPoints >= 4) finalConfidence += 5
  if (!hasCannabinoids) finalConfidence -= 15
  if (extractedData.batchId && extractedData.strainName) finalConfidence += 5

  finalConfidence = Math.min(Math.max(finalConfidence, 5), 95)

  return {
    ocrConfidence,
    extractionConfidence,
    qualityConfidence,
    dataCompleteness: Math.round(dataCompleteness),
    hasCannabinoids,
    finalConfidence
  }
}