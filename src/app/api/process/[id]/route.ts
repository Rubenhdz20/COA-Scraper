import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPDFWithMistral } from '@/lib/ocr/mistralOCR'
import { extractDataFromOCRText } from '@/lib/dataExtractor'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    const document = await prisma.coaDocument.findUnique({ where: { id: documentId } })
    if (!document) {
      return NextResponse.json({ success: false, error: `Document with ID ${documentId} not found` }, { status: 404 })
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
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    const existingDocument = await prisma.coaDocument.findUnique({ where: { id: documentId } })
    if (!existingDocument) {
      return NextResponse.json({ success: false, error: `Document with ID ${documentId} not found` }, { status: 404 })
    }

    await prisma.coaDocument.update({ where: { id: documentId }, data: { processingStatus: 'processing' } })

    let ocrResult: any = null
    let extractedData: any = null

    try {
      console.log('📄 Step 1: OCR...')
      ocrResult = await processPDFWithMistral(existingDocument.filePath)
      if (!ocrResult.success || !ocrResult.extractedText?.trim()) {
        throw new Error(ocrResult.error || 'OCR produced empty text')
      }

      // ============================================================
      // ADD DIAGNOSTIC LOGGING HERE (after OCR, before extraction)
      // ============================================================
      console.log('\n=== OCR DIAGNOSTIC ===')
      console.log('Total text length:', ocrResult.extractedText.length)
      console.log('Page count:', ocrResult.metadata?.pageCount)
      console.log('Has images:', ocrResult.metadata?.hasImages)
      console.log('Has tables:', ocrResult.metadata?.hasTables)
      console.log('OCR confidence:', ocrResult.confidence)
      console.log('OCR provider:', ocrResult.provider)

      console.log('🤖 Step 2: Extraction...')
      extractedData = await extractDataFromOCRText(ocrResult.extractedText)

      console.log('Extraction summary:', {
        batchId: extractedData.batchId,
        strainName: extractedData.strainName,
        thc: extractedData.thcPercentage,
        cbd: extractedData.cbdPercentage,
        total: extractedData.totalCannabinoids,
        testDate: extractedData.testDate,
        terpsCount: extractedData.terpenes?.length || 0,
        confidence: extractedData.confidence
      })

      // Prepare DB data
      const updateData = {
        processingStatus: 'completed' as const,
        rawText: ocrResult.extractedText,
        ocrProvider: ocrResult.provider,
        confidence: extractedData.confidence,
        batchId: extractedData.batchId,
        strainName: extractedData.strainName,
        category: extractedData.category,
        subCategory: extractedData.subCategory,
        thcPercentage: extractedData.thcPercentage,
        cbdPercentage: extractedData.cbdPercentage,
        totalCannabinoids: extractedData.totalCannabinoids,
        labName: extractedData.labName,
        testDate: extractedData.testDate || null,
        terpenes: extractedData.terpenes && extractedData.terpenes.length > 0
          ? JSON.stringify(extractedData.terpenes)
          : null
      }

      console.log('Saving to database with:', {
        testDate: updateData.testDate,
        terpenesCount: extractedData.terpenes?.length || 0
      })

      const updated = await prisma.coaDocument.update({
        where: { id: documentId },
        data: updateData
      })

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Processed successfully'
      })
    } catch (processingError) {
      console.error('❌ Processing error:', processingError)
      await prisma.coaDocument.update({
        where: { id: documentId },
        data: {
          processingStatus: 'failed',
          rawText: ocrResult?.extractedText || 'Processing failed before OCR text was available',
          confidence: 0
        }
      })
      return NextResponse.json({ success: false, error: (processingError as Error).message }, { status: 500 })
    }
  } catch (error) {
    try {
      await prisma.coaDocument.update({
        where: { id: (await params).id },
        data: { processingStatus: 'failed', confidence: 0, rawText: `Critical processing error: ${error instanceof Error ? error.message : 'Unknown'}` }
      })
    } catch {}
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 })
  }
}