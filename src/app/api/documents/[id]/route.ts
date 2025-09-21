import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id

    const document = await prisma.coaDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        fileSize: true,
        processingStatus: true,
        uploadDate: true,
        // Extracted data
        batchId: true,
        strainName: true,
        thcPercentage: true,
        cbdPercentage: true,
        totalCannabinoids: true,
        labName: true,
        testDate: true,
        terpenes: true,
        // OCR metadata
        ocrProvider: true,
        confidence: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Parse terpenes JSON if it exists
    let parsedTerpenes = null
    if (document.terpenes) {
      try {
        parsedTerpenes = JSON.parse(document.terpenes)
      } catch (error) {
        console.error('Error parsing terpenes JSON:', error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...document,
        terpenes: parsedTerpenes
      }
    })

  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id
    const body = await request.json()
    
    const document = await prisma.coaDocument.update({
      where: { id: documentId },
      data: body
    })

    return NextResponse.json({
      success: true,
      message: 'Document updated successfully',
      data: document
    })

  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id

    await prisma.coaDocument.delete({
      where: { id: documentId }
    })

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}