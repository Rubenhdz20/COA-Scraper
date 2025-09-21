import { NextRequest, NextResponse } from 'next/server'
import { validateOCRSetup } from '@/lib/ocr/testOCR'
import { processDocumentOCR } from '@/lib/ocr/ocrService'
import { extractCOAData } from '@/lib/dataExtractor'
import path from 'path'
import fs from 'fs'

export async function GET() {
  try {
    // Validate OCR setup
    const validation = await validateOCRSetup()
    
    return NextResponse.json({
      success: true,
      validation,
      message: validation.isValid ? 'OCR setup is valid' : 'OCR setup has issues'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      validation: {
        isValid: false,
        issues: ['Failed to validate OCR setup'],
        recommendations: ['Check server logs for detailed error information']
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { filename } = await request.json()
    
    if (!filename) {
      return NextResponse.json({
        success: false,
        error: 'Filename is required'
      }, { status: 400 })
    }

    // Check if file exists in uploads directory
    const filePath = path.join(process.cwd(), 'uploads', filename)
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        success: false,
        error: 'File not found in uploads directory'
      }, { status: 404 })
    }

    // Test OCR processing
    const startTime = Date.now()
    const ocrResult = await processDocumentOCR(filePath)
    const processingTime = Date.now() - startTime

    if (!ocrResult.success) {
      return NextResponse.json({
        success: false,
        error: ocrResult.error,
        ocrResult
      }, { status: 500 })
    }

    // Test data extraction
    const extractedData = extractCOAData(ocrResult.extractedText)
    
    // Generate test report
    const testReport = {
      file: {
        name: filename,
        path: filePath,
        size: fs.statSync(filePath).size
      },
      ocr: {
        provider: ocrResult.provider,
        success: ocrResult.success,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
        textLength: ocrResult.extractedText.length,
        metadata: ocrResult.metadata
      },
      extraction: {
        fieldsExtracted: {
          batchId: !!extractedData.batchId,
          strainName: !!extractedData.strainName,
          thcPercentage: extractedData.thcPercentage !== null,
          cbdPercentage: extractedData.cbdPercentage !== null,
          terpenes: extractedData.terpenes.length > 0,
          labName: !!extractedData.labName,
          testDate: !!extractedData.testDate
        },
        extractedData,
        extractionRate: calculateExtractionRate(extractedData)
      },
      performance: {
        totalProcessingTime: processingTime,
        ocrTime: ocrResult.processingTime,
        extractionTime: processingTime - ocrResult.processingTime
      },
      textSample: ocrResult.extractedText.substring(0, 500) + 
                  (ocrResult.extractedText.length > 500 ? '...' : '')
    }

    return NextResponse.json({
      success: true,
      message: 'OCR test completed successfully',
      testReport
    })

  } catch (error) {
    console.error('OCR test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'OCR test failed'
    }, { status: 500 })
  }
}

function calculateExtractionRate(data: any): number {
  const fields = [
    'batchId', 'strainName', 'thcPercentage', 'cbdPercentage', 
    'labName', 'testDate'
  ]
  
  const extractedCount = fields.filter(field => {
    const value = data[field]
    return value !== null && value !== undefined && value !== ''
  }).length
  
  const terpeneBonus = data.terpenes && data.terpenes.length > 0 ? 1 : 0
  
  return Math.round(((extractedCount + terpeneBonus) / (fields.length + 1)) * 100)
}