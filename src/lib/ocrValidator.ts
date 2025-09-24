export interface OCRQualityReport {
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  confidence: number
  issues: string[]
  recommendations: string[]
  coaIndicators: {
    hasCertificateHeader: boolean
    hasLabName: boolean
    hasPercentages: boolean
    hasTerpenes: boolean
    hasTabularData: boolean
  }
}

export function validateOCRQuality(ocrText: string): OCRQualityReport {
  const issues: string[] = []
  const recommendations: string[] = []
  let confidence = 100

  // Basic text quality checks
  const textLength = ocrText.length
  const hasReplacementChars = ocrText.includes('�')
  const specialCharRatio = (ocrText.match(/[^\w\s\.\-\%\(\)\:\,\/\n]/g) || []).length / textLength

  // COA-specific content detection
  const coaIndicators = {
    hasCertificateHeader: /certificate\s+of\s+analysis/i.test(ocrText),
    hasLabName: /labs?\s*(?:inc|llc|corp)/i.test(ocrText),
    hasPercentages: /\d+\.?\d*\s*%/.test(ocrText),
    hasTerpenes: /(myrcene|limonene|pinene|caryophyllene|terpene)/i.test(ocrText),
    hasTabularData: ocrText.includes('\t') || /\s{3,}/.test(ocrText)
  }

  // Text length assessment
  if (textLength < 500) {
    issues.push('Very short text extracted - may indicate OCR failure')
    confidence -= 30
    recommendations.push('Check if PDF contains actual text or is a scanned image')
  } else if (textLength < 1000) {
    issues.push('Short text extracted - may be missing content')
    confidence -= 15
  }

  // Character quality assessment
  if (hasReplacementChars) {
    issues.push('Contains replacement characters (�) - encoding issues detected')
    confidence -= 20
    recommendations.push('Try re-processing with different OCR settings')
  }

  if (specialCharRatio > 0.1) {
    issues.push('High ratio of special characters - may indicate OCR corruption')
    confidence -= 15
    recommendations.push('Document may have poor image quality or complex formatting')
  }

  // COA content validation
  if (!coaIndicators.hasCertificateHeader) {
    issues.push('No "Certificate of Analysis" header found')
    confidence -= 10
    recommendations.push('Verify this is a COA document')
  }

  if (!coaIndicators.hasPercentages) {
    issues.push('No percentage values found - critical for cannabis analysis')
    confidence -= 25
    recommendations.push('Check if numerical data was extracted properly')
  }

  if (!coaIndicators.hasLabName) {
    issues.push('No laboratory name detected')
    confidence -= 10
  }

  if (!coaIndicators.hasTerpenes) {
    issues.push('No terpene data detected')
    confidence -= 5
    recommendations.push('Document may not include terpene analysis')
  }

  if (!coaIndicators.hasTabularData) {
    issues.push('No tabular data structure detected')
    confidence -= 15
    recommendations.push('Data may be in non-standard format')
  }

  // Determine quality level
  let quality: OCRQualityReport['quality']
  if (confidence >= 85) quality = 'excellent'
  else if (confidence >= 70) quality = 'good'
  else if (confidence >= 50) quality = 'fair'
  else quality = 'poor'

  // Add quality-specific recommendations
  if (quality === 'poor') {
    recommendations.push('Consider manual review or document reprocessing')
    recommendations.push('Check source PDF quality and format')
  } else if (quality === 'fair') {
    recommendations.push('May require manual verification of extracted data')
  }

  return {
    quality,
    confidence: Math.max(confidence, 0),
    issues,
    recommendations,
    coaIndicators
  }
}

export function shouldProceedWithExtraction(qualityReport: OCRQualityReport): boolean {
  // Don't proceed if quality is too poor
  if (qualityReport.quality === 'poor' && qualityReport.confidence < 30) {
    return false
  }

  // Must have basic COA indicators
  const { coaIndicators } = qualityReport
  const essentialIndicators = [
    coaIndicators.hasCertificateHeader || coaIndicators.hasLabName,
    coaIndicators.hasPercentages
  ]

  return essentialIndicators.every(indicator => indicator)
}

export function getOptimalExtractionStrategy(qualityReport: OCRQualityReport): string {
  const { quality, coaIndicators } = qualityReport

  if (quality === 'excellent' && coaIndicators.hasTabularData) {
    return 'comprehensive'
  }

  if (coaIndicators.hasTabularData && coaIndicators.hasPercentages) {
    return 'table-focused'
  }

  if (quality === 'fair' || quality === 'poor') {
    return 'regex-guided'
  }

  return 'comprehensive'
}