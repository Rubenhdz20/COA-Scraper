// src/app/api/process/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET handler - Check processing status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    
    console.log('Checking status for document ID:', documentId)

    // Find the document
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
        // Include extracted data if processing is complete
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

// POST handler - Start processing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    
    console.log('Processing document ID:', documentId)

    // First, verify the document exists
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

    // Update status to processing first
    await prisma.coaDocument.update({
      where: { id: documentId },
      data: {
        processingStatus: 'processing'
      }
    })

    // Simulate processing delay (remove this in production)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Update the document with mock data
    const updatedDocument = await prisma.coaDocument.update({
      where: { id: documentId },
      data: {
        processingStatus: 'completed',
        rawText: 'Test extraction - OCR processing temporarily disabled',
        ocrProvider: 'mock',
        confidence: 85,
        batchId: '1A4090001234567',
        strainName: 'Cereal Milk',
        category: 'Vape',
        subCategory: 'Cartridge (510 Thread)',
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

    console.log('Document updated successfully')

    return NextResponse.json({
      success: true,
      data: updatedDocument
    })

  } catch (error) {
    console.error('Error processing document:', error)
    
    // Update status to failed if something goes wrong
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