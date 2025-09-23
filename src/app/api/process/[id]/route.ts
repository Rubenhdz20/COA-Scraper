// src/app/api/process/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPDFWithMistral } from '@/lib/ocr/mistralOCR'
import { extractDataFromOCRText } from '@/lib/dataExtractor'

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

// POST handler - Start REAL processing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    
    console.log('Starting REAL processing for document ID:', documentId)

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

    try {
      // STEP 1: OCR Processing with Mistral
      console.log('Step 1: Starting OCR processing...')
      const ocrResult = await processPDFWithMistral(existingDocument.filePath)
      
      if (!ocrResult.success) {
        throw new Error(`OCR failed: ${ocrResult.error}`)
      }

      if (!ocrResult.extractedText || ocrResult.extractedText.trim().length === 0) {
        throw new Error('OCR completed but no text was extracted')
      }

      console.log('OCR completed successfully')
      console.log('OCR confidence:', ocrResult.confidence)
      console.log('Extracted text length:', ocrResult.extractedText.length)
      console.log('OCR text preview:', ocrResult.extractedText.substring(0, 200) + '...')

      // STEP 2: AI Data Extraction
      console.log('Step 2: Starting AI data extraction...')
      const extractedData = await extractDataFromOCRText(ocrResult.extractedText)
      
      console.log('Data extraction completed')
      console.log('Extraction confidence:', extractedData.confidence)
      console.log('Extracted data summary:', {
        strain: extractedData.strainName,
        thc: extractedData.thcPercentage,
        cbd: extractedData.cbdPercentage,
        terpenes: extractedData.terpenes?.length || 0
      })

      // STEP 3: Save results to database
      console.log('Step 3: Saving results to database...')
      const updatedDocument = await prisma.coaDocument.update({
        where: { id: documentId },
        data: {
          processingStatus: 'completed',
          rawText: ocrResult.extractedText,
          ocrProvider: ocrResult.provider,
          confidence: Math.min(ocrResult.confidence || 0, extractedData.confidence), // Use lower confidence
          batchId: extractedData.batchId,
          strainName: extractedData.strainName,
          category: extractedData.category,
          subCategory: extractedData.subCategory,
          thcPercentage: extractedData.thcPercentage,
          cbdPercentage: extractedData.cbdPercentage,
          totalCannabinoids: extractedData.totalCannabinoids,
          labName: extractedData.labName,
          testDate: extractedData.testDate ? new Date(extractedData.testDate) : null,
          terpenes: extractedData.terpenes ? JSON.stringify(extractedData.terpenes) : null
        }
      })

      console.log('Document processing completed successfully!')

      return NextResponse.json({
        success: true,
        data: updatedDocument,
        message: 'Document processed successfully with real OCR and AI extraction'
      })

    } catch (processingError) {
      console.error('Error during OCR/extraction processing:', processingError)
      
      // Update status to failed with error details
      await prisma.coaDocument.update({
        where: { id: documentId },
        data: {
          processingStatus: 'failed',
          rawText: `Processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`
        }
      })

      return NextResponse.json({
        success: false,
        error: `Processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in process route:', error)
    
    // Try to update status to failed
    try {
      await prisma.coaDocument.update({
        where: { id: (await params).id },
        data: { processingStatus: 'failed' }
      })
    } catch (updateError) {
      console.error('Failed to update document status to failed:', updateError)
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}