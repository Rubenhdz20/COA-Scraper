import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const document = await prisma.coaDocument.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        processingStatus: true,
        confidence: true,
        ocrProvider: true,
        batchId: true,
        strainName: true,
        thcPercentage: true,
        cbdPercentage: true,
        totalCannabinoids: true,
        terpenes: true,
        updatedAt: true
      }
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: document
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get processing status' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id

    // Just update the status to completed for now
    const updatedDocument = await prisma.coaDocument.update({
      where: { id: documentId },
      data: {
        processingStatus: 'completed',
        rawText: 'Test extraction - OCR processing temporarily disabled',
        ocrProvider: 'mock',
        confidence: 85,
        batchId: '1A4090001234567',
        strainName: 'Cereal Milk',
        thcPercentage: 90.51,
        cbdPercentage: 0.25,
        totalCannabinoids: 94.96,
        labName: 'Test Lab',
        testDate: new Date().toISOString(),
        terpenes: JSON.stringify([
          { name: 'β-Caryophyllene', percentage: 1.8 },
          { name: 'δ-Limonene', percentage: 1.2 },
          { name: 'α-Humulene', percentage: 0.7 }
        ])
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Document processed successfully (test mode)',
      data: updatedDocument
    })

  } catch (error) {
    console.error('Processing error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}