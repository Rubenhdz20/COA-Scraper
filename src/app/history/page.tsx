'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DocumentStats } from '@/components/coa/DocumentStats'
import { deleteDocument } from '@/lib/fileUpload'

interface Document {
  id: string
  filename: string
  originalName: string
  fileSize: number
  processingStatus: string
  uploadDate: string
  batchId?: string
  strainName?: string
  thcPercentage?: number
  cbdPercentage?: number
  confidence?: number
  createdAt: string
}

interface DocumentsResponse {
  success: boolean
  data?: {
    documents: Document[]
    pagination: {
      currentPage: number
      totalPages: number
      totalCount: number
      hasNextPage: boolean
      hasPreviousPage: boolean
    }
  }
  error?: string
}

export default function HistoryPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const fetchDocuments = async (page: number = 1, status: string = '') => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      })
      
      if (status) {
        params.append('status', status)
      }

      const response = await fetch(`/api/documents?${params}`)
      const data: DocumentsResponse = await response.json()

      if (data.success && data.data) {
        setDocuments(data.data.documents)
        setCurrentPage(data.data.pagination.currentPage)
        setTotalPages(data.data.pagination.totalPages)
      } else {
        setError(data.error || 'Failed to fetch documents')
      }
    } catch (err) {
      setError('Network error while fetching documents')
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments(currentPage, statusFilter)
  }, [currentPage, statusFilter])

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      await deleteDocument(documentId)
      // Refresh the list
      fetchDocuments(currentPage, statusFilter)
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete document')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800', 
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    }

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  if (loading && documents.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload History</h1>
        <p className="text-gray-600 mt-1">
          View and manage all your processed COA documents
        </p>
      </div>

      {/* Stats Overview */}
      <DocumentStats />

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          <div className="flex-1"></div>
          
          <Button
            onClick={() => fetchDocuments(currentPage, statusFilter)}
            variant="outline"
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
          <p className="text-gray-600">Upload your first COA document to get started.</p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Documents ({documents.length})</CardTitle>
          </CardHeader>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Extracted Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Upload Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-48">
                            {doc.originalName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(doc.fileSize)}
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4">
                      {getStatusBadge(doc.processingStatus)}
                    </td>
                    
                    <td className="px-4 py-4">
                      {doc.processingStatus === 'completed' ? (
                        <div className="text-sm">
                          {doc.strainName && (
                            <p><span className="font-medium">Strain:</span> {doc.strainName}</p>
                          )}
                          {doc.batchId && (
                            <p><span className="font-medium">Batch:</span> {doc.batchId}</p>
                          )}
                          {doc.thcPercentage !== undefined && (
                            <p><span className="font-medium">THC:</span> {doc.thcPercentage}%</p>
                          )}
                          {doc.cbdPercentage !== undefined && (
                            <p><span className="font-medium">CBD:</span> {doc.cbdPercentage}%</p>
                          )}
                          {doc.confidence && (
                            <p className="text-xs text-gray-500">
                              Confidence: {doc.confidence}%
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No data extracted</span>
                      )}
                    </td>
                    
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatDate(doc.uploadDate)}
                    </td>
                    
                    <td className="px-4 py-4">
                      <div className="flex space-x-2">
                        {doc.processingStatus === 'completed' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => window.location.href = `/results/${doc.id}`}
                          >
                            View Results
                          </Button>
                        )}
                        
                        {doc.processingStatus === 'failed' && (
                          <Button size="sm" variant="outline">
                            Retry
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </Button>
          
          <span className="flex items-center px-4 py-2 text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}