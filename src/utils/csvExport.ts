interface TerpeneData {
  name: string
  percentage: number
}

interface ExportData {
  batchId?: string
  strainName?: string
  category?: string
  subCategory?: string
  thcPercentage?: number
  cbdPercentage?: number
  totalCannabinoids?: number
  labName?: string
  testDate?: string
  terpenes?: TerpeneData[]
  confidence?: number
  originalName?: string
  uploadDate?: string
}

export function exportToCSV(data: ExportData, filename?: string): void {
  // Prepare CSV headers
  const headers = [
    'Document Name',
    'Upload Date', 
    'Batch ID',
    'Strain Name',
    'Category',
    'Sub-Category',
    'THC %',
    'CBD %',
    'Total Cannabinoids %',
    'Lab Name',
    'Test Date',
    'Top Terpenes',
    'Confidence Score'
  ]

  // Format terpenes for CSV (top 5)
  const formatTerpenes = (terpenes?: TerpeneData[]): string => {
    if (!terpenes || terpenes.length === 0) return 'N/A'
    
    return terpenes
      .slice(0, 5) // Top 5 terpenes
      .map(t => `${t.name}: ${t.percentage}%`)
      .join('; ')
  }

  // Format date for CSV
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  // Create CSV row
  const row = [
    data.originalName || 'N/A',
    formatDate(data.uploadDate),
    data.batchId || 'N/A',
    data.strainName || 'N/A',
    data.category || 'N/A',
    data.subCategory || 'N/A',
    data.thcPercentage?.toString() || 'N/A',
    data.cbdPercentage?.toString() || 'N/A', 
    data.totalCannabinoids?.toString() || 'N/A',
    data.labName || 'N/A',
    formatDate(data.testDate),
    formatTerpenes(data.terpenes),
    data.confidence?.toString() || 'N/A'
  ]

  // Escape CSV values (handle commas, quotes)
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  // Create CSV content
  const csvContent = [
    headers.join(','),
    row.map(escapeCSV).join(',')
  ].join('\n')

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename || `COA_Extract_${data.strainName || 'Document'}_${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// Export multiple documents to single CSV
export function exportMultipleToCSV(documents: ExportData[], filename?: string): void {
  if (documents.length === 0) return

  const headers = [
    'Document Name',
    'Upload Date',
    'Batch ID', 
    'Strain Name',
    'Category',
    'Sub-Category',
    'THC %',
    'CBD %',
    'Total Cannabinoids %',
    'Lab Name',
    'Test Date',
    'Top Terpenes',
    'Confidence Score'
  ]

  const formatTerpenes = (terpenes?: TerpeneData[]): string => {
    if (!terpenes || terpenes.length === 0) return 'N/A'
    return terpenes.slice(0, 5).map(t => `${t.name}: ${t.percentage}%`).join('; ')
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  // Create rows for all documents
  const rows = documents.map(data => {
    const row = [
      data.originalName || 'N/A',
      formatDate(data.uploadDate),
      data.batchId || 'N/A',
      data.strainName || 'N/A', 
      data.category || 'N/A',
      data.subCategory || 'N/A',
      data.thcPercentage?.toString() || 'N/A',
      data.cbdPercentage?.toString() || 'N/A',
      data.totalCannabinoids?.toString() || 'N/A',
      data.labName || 'N/A',
      formatDate(data.testDate),
      formatTerpenes(data.terpenes),
      data.confidence?.toString() || 'N/A'
    ]
    return row.map(escapeCSV).join(',')
  })

  // Create CSV content
  const csvContent = [headers.join(','), ...rows].join('\n')

  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename || `COA_Extracts_${Date.now()}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}