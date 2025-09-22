'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'

interface TerpeneData {
  name: string
  percentage: number
}

interface DocumentData {
  id: string
  originalName: string
  processingStatus: string
  uploadDate: string
  confidence?: number
  batchId?: string
  strainName?: string
  category?: string
  subCategory?: string
  thcPercentage?: number
  cbdPercentage?: number
  totalCannabinoids?: number
  labName?: string
  testDate?: string
  ocrProvider?: string
  terpenes?: TerpeneData[]
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const [document, setDocument] = useState<DocumentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [documentId, setDocumentId] = useState<string>('')

  useEffect(() => {
    // Unwrap the params Promise
    params.then(({ id }) => {
      setDocumentId(id)
      
      fetch(`/api/documents/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setDocument(data.data)
          }
          setLoading(false)
        })
        .catch(error => {
          console.error('Error fetching document:', error)
          setLoading(false)
        })
    })
  }, [params])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="h-32 bg-gray-300 rounded"></div>
          <div className="h-48 bg-gray-300 rounded"></div>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Card>
          <div className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600">Document not found</h2>
            <p className="text-gray-600 mt-2">The requested document could not be found.</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">COA Extraction Results</h1>
        {document.confidence && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Confidence:</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              document.confidence >= 80 ? 'bg-green-100 text-green-800' :
              document.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {document.confidence}%
            </span>
          </div>
        )}
      </div>

      {/* Document Information */}
      <Card>
        <CardHeader>
          <CardTitle>Document Information</CardTitle>
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">File:</span>
              <p className="font-medium">{document.originalName}</p>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <p className={`font-medium capitalize ${
                document.processingStatus === 'completed' ? 'text-green-600' :
                document.processingStatus === 'processing' ? 'text-blue-600' :
                'text-red-600'
              }`}>
                {document.processingStatus}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Uploaded:</span>
              <p className="font-medium">{new Date(document.uploadDate).toLocaleString()}</p>
            </div>
            {document.ocrProvider && (
              <div>
                <span className="text-gray-600">OCR Provider:</span>
                <p className="font-medium capitalize">{document.ocrProvider}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Lab Information */}
      {(document.labName || document.testDate) && (
        <Card>
          <CardHeader>
            <CardTitle>Lab Information</CardTitle>
          </CardHeader>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {document.labName && (
                <div>
                  <span className="text-gray-600">Lab:</span>
                  <p className="font-medium">{document.labName}</p>
                </div>
              )}
              {document.testDate && (
                <div>
                  <span className="text-gray-600">Test Date:</span>
                  <p className="font-medium">{new Date(document.testDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Product Information */}
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <span className="text-gray-600">Batch ID:</span>
              <p className="font-medium">{document.batchId || 'Not found'}</p>
            </div>
            <div>
              <span className="text-gray-600">Strain:</span>
              <p className="font-medium">{document.strainName || 'Not found'}</p>
            </div>
            {document.category && (
              <div>
                <span className="text-gray-600">Category:</span>
                <p className="font-medium">{document.category}</p>
              </div>
            )}
            {document.subCategory && (
              <div className="md:col-span-2 lg:col-span-3">
                <span className="text-gray-600">Sub-category:</span>
                <p className="font-medium">{document.subCategory}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Cannabinoid Results */}
      <Card>
        <CardHeader>
          <CardTitle>Cannabinoid Analysis</CardTitle>
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {document.thcPercentage ? `${document.thcPercentage}%` : 'N/A'}
              </div>
              <div className="text-gray-600 mt-1">THC</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {document.cbdPercentage ? `${document.cbdPercentage}%` : 'N/A'}
              </div>
              <div className="text-gray-600 mt-1">CBD</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {document.totalCannabinoids ? `${document.totalCannabinoids}%` : 'N/A'}
              </div>
              <div className="text-gray-600 mt-1">Total Cannabinoids</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Terpene Profile */}
      {document.terpenes && document.terpenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Terpene Profile</CardTitle>
          </CardHeader>
          <div className="p-6">
            <div className="space-y-3">
              {document.terpenes.map((terpene, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <span className="font-medium">{terpene.name}</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                        style={{ width: `${Math.min(terpene.percentage * 20, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-mono min-w-[3rem] text-right">
                      {terpene.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}