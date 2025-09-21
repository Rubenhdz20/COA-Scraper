import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test database connection by getting count of documents
    const count = await prisma.coaDocument.count()
    
    // Test creating a sample document
    const testDoc = await prisma.coaDocument.create({
      data: {
        filename: 'test-document.pdf',
        originalName: 'Test Document.pdf',
        fileSize: 12345,
        processingStatus: 'completed',
        batchId: 'TEST-001',
        strainName: 'Test Strain',
        thcPercentage: 25.5,
        cbdPercentage: 1.2,
        rawText: 'This is test OCR text',
        ocrProvider: 'test',
        confidence: 95.0,
        terpenes: JSON.stringify([
          { name: 'β-Caryophyllene', percentage: 1.8 },
          { name: 'D-Limonene', percentage: 1.2 }
        ])
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful!',
      data: {
        totalDocuments: count + 1,
        testDocument: {
          id: testDoc.id,
          filename: testDoc.filename,
          batchId: testDoc.batchId,
          strainName: testDoc.strainName,
          createdAt: testDoc.createdAt
        }
      }
    })
  } catch (error) {
    console.error('Database test error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    // Clean up test data
    await prisma.coaDocument.deleteMany({
      where: {
        filename: 'test-document.pdf'
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Test data cleaned up'
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Cleanup failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}