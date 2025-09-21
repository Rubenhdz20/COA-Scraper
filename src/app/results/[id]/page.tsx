// src/app/results/[id]/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const [document, setDocument] = useState<any>(null)
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

  if (loading) return <div className="p-8">Loading...</div>

  if (!document) return <div className="p-8">Document not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Extraction Results</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Document Information</CardTitle>
        </CardHeader>
        <div className="p-6">
          <p><strong>File:</strong> {document.originalName}</p>
          <p><strong>Status:</strong> {document.processingStatus}</p>
          <p><strong>Uploaded:</strong> {new Date(document.uploadDate).toLocaleString()}</p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extracted Data</CardTitle>
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Batch ID:</strong> {document.batchId || 'Not found'}
            </div>
            <div>
              <strong>Strain:</strong> {document.strainName || 'Not found'}
            </div>
            <div>
              <strong>THC:</strong> {document.thcPercentage ? `${document.thcPercentage}%` : 'Not found'}
            </div>
            <div>
              <strong>CBD:</strong> {document.cbdPercentage ? `${document.cbdPercentage}%` : 'Not found'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}