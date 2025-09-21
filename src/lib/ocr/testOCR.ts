import { getOCRService } from './ocrService'
import fs from 'fs'
import path from 'path'

export interface OCRTestResult {
  provider: string
  success: boolean
  processingTime: number
  confidence?: number
  textLength: number
  error?: string
  extractedSample?: string // First 200 chars
}

export async function testOCRWithFile(filePath: string): Promise<{
  results: OCRTestResult[]
  summary: {
    bestProvider: string
    totalAttempts: number
    successfulAttempts: number
    avgProcessingTime: number
    recommendations: string[]
  }
}> {
  const results: OCRTestResult[] = []
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test file not found: ${filePath}`)
  }

  const fileStats = fs.statSync(filePath)
  console.log(`Testing OCR with file: ${path.basename(filePath)} (${fileStats.size} bytes)`)

  // Test Mistral OCR
  try {
    const ocrService = getOCRService({ preferredProvider: 'mistral' })
    const result = await ocrService.processDocument(filePath)
    
    results.push({
      provider: result.provider,
      success: result.success,
      processingTime: result.processingTime,
      confidence: result.confidence,
      textLength: result.extractedText.length,
      error: result.error,
      extractedSample: result.extractedText.substring(0, 200) + (result.extractedText.length > 200 ? '...' : '')
    })
  } catch (error) {
    results.push({
      provider: 'mistral-ocr',
      success: false,
      processingTime: 0,
      textLength: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test pdf-parse fallback
  try {
    const ocrService = getOCRService({ preferredProvider: 'pdf-parse' })
    const result = await ocrService.processDocument(filePath)
    
    results.push({
      provider: result.provider,
      success: result.success,
      processingTime: result.processingTime,
      confidence: result.confidence,
      textLength: result.extractedText.length,
      error: result.error,
      extractedSample: result.extractedText.substring(0, 200) + (result.extractedText.length > 200 ? '...' : '')
    })
  } catch (error) {
    results.push({
      provider: 'pdf-parse',
      success: false,
      processingTime: 0,
      textLength: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Generate summary
  const successfulResults = results.filter(r => r.success)
  const bestProvider = successfulResults.reduce((best, current) => {
    if (!best) return current
    // Prefer higher confidence and longer text
    const bestScore = (best.confidence || 0) + (best.textLength / 100)
    const currentScore = (current.confidence || 0) + (current.textLength / 100)
    return currentScore > bestScore ? current : best
  }, null as OCRTestResult | null)

  const recommendations: string[] = []
  
  if (successfulResults.length === 0) {
    recommendations.push('No OCR providers working - check API keys and file format')
  } else if (successfulResults.length === 1) {
    recommendations.push(`Only ${successfulResults[0].provider} working - consider adding backup providers`)
  } else {
    recommendations.push(`Multiple providers working - ${bestProvider?.provider} recommended for best results`)
  }

  if (bestProvider && bestProvider.confidence && bestProvider.confidence < 80) {
    recommendations.push('Low confidence detected - consider document quality or different OCR provider')
  }

  return {
    results,
    summary: {
      bestProvider: bestProvider?.provider || 'none',
      totalAttempts: results.length,
      successfulAttempts: successfulResults.length,
      avgProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      recommendations
    }
  }
}

export async function validateOCRSetup(): Promise<{
  isValid: boolean
  issues: string[]
  recommendations: string[]
}> {
  const issues: string[] = []
  const recommendations: string[] = []

  // Check environment variables
  if (!process.env.MISTRAL_API_KEY) {
    issues.push('MISTRAL_API_KEY not set')
    recommendations.push('Add your Mistral API key to .env file')
  }

  // Check OCR service configuration
  try {
    const ocrService = getOCRService()
    const validation = await ocrService.validateConfiguration()
    
    if (!validation.mistralAvailable) {
      issues.push('Mistral OCR not available')
    }

    issues.push(...validation.errors)

    if (validation.mistralAvailable && validation.pdfParseAvailable) {
      recommendations.push('Both OCR providers configured - excellent redundancy')
    } else if (validation.pdfParseAvailable) {
      recommendations.push('Only fallback OCR available - consider setting up Mistral for better accuracy')
    }

  } catch (error) {
    issues.push(`OCR service configuration error: ${error}`)
  }

  // Check uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    issues.push('Uploads directory does not exist')
    recommendations.push('Create uploads directory or upload a test file')
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations
  }
}