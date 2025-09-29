// src/app/results/[id]/page.tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { CopyAllData } from '@/components/ui/CopyableField'
import { exportToCSV } from '@/utils/csvExport'

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
  terpenes?: TerpeneData[] | null
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const [document, setDocument] = useState<DocumentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [documentId, setDocumentId] = useState<string>('')

  useEffect(() => {
    params.then(({ id }) => {
      setDocumentId(id)
      
      fetch(`/api/documents/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Ensure terpenes is a proper array (API may return null or stringified JSON)
            const terps = Array.isArray(data.data?.terpenes)
              ? data.data.terpenes
              : (typeof data.data?.terpenes === 'string'
                  ? safeParseJSON<TerpeneData[]>(data.data.terpenes)
                  : null)

            setDocument({
              ...data.data,
              terpenes: terps
            })
          }
          setLoading(false)
        })
        .catch(error => {
          console.error('Error fetching document:', error)
          setLoading(false)
        })
    })
  }, [params])

  const handleCSVExport = () => {
    if (!document) return
    
    exportToCSV({
      originalName: document.originalName,
      uploadDate: document.uploadDate,
      batchId: document.batchId,
      strainName: document.strainName,
      category: document.category,
      subCategory: document.subCategory,
      thcPercentage: document.thcPercentage,
      cbdPercentage: document.cbdPercentage,
      totalCannabinoids: document.totalCannabinoids,
      labName: document.labName,
      testDate: document.testDate,
      terpenes: document.terpenes ?? undefined,
      confidence: document.confidence
    })
  }

  // Top 3 terpenes (sorted desc), memoized
  const topTerpenes = useMemo(() => {
    const arr = (document?.terpenes || []).filter(Boolean)
    return [...arr].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)).slice(0, 3)
  }, [document?.terpenes])

  // For normalized bars, scale to the max value among top3
  const maxTop = useMemo(
    () => (topTerpenes.length ? Math.max(...topTerpenes.map(t => t.percentage || 0)) : 0),
    [topTerpenes]
  )

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
        <div className="flex items-center space-x-4">
          {document.confidence !== undefined && (
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
      </div>

      {/* Export Actions */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Export Data</h3>
              <p className="text-sm text-gray-600">Download or copy the extracted information</p>
            </div>
            <div className="flex space-x-3">
              <CopyAllData data={document} />
              <button
                onClick={handleCSVExport}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download CSV</span>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Document Information */}
      <Card>
        <CardHeader>
          <CardTitle>Document Information</CardTitle>
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <span className="text-gray-600">Batch ID:</span>
              <p className="font-medium">{document.batchId || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-600">Strain:</span>
              <p className="font-medium">{document.strainName || 'N/A'}</p>
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
                {formatPct(document.thcPercentage)}
              </div>
              <div className="text-gray-600 mt-1">THC</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {formatPct(document.cbdPercentage)}
              </div>
              <div className="text-gray-600 mt-1">CBD</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {formatPct(document.totalCannabinoids)}
              </div>
              <div className="text-gray-600 mt-1">Total Cannabinoids</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Terpene Profile (Top 3) */}
      <Card>
        <CardHeader>
          <CardTitle>Terpene Profile</CardTitle>
        </CardHeader>
        <div className="p-6">
          {!document.terpenes || document.terpenes.length === 0 ? (
            <div className="text-sm text-gray-600">
              No terpene panel detected or no reportable terpenes found.
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-4">
                Showing top {topTerpenes.length} of {document.terpenes.length} terpenes detected.
              </div>
              <div className="space-y-4">
                {topTerpenes.map((t, i) => {
                  const barPct = maxTop > 0 ? (t.percentage / maxTop) * 100 : 0
                  return (
                    <div key={`${t.name}-${i}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <span className="font-medium">{t.name}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-40 bg-gray-200 rounded-full h-2" aria-hidden>
                          <div
                            className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2 rounded-full"
                            style={{ width: `${Math.min(barPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono min-w-[4.5rem] text-right">
                          {t.percentage.toFixed(3)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Full list (collapsible style without JS lib) */}
              {document.terpenes.length > topTerpenes.length && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    Show full terpene list
                  </summary>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {[...document.terpenes]
                      .sort((a, b) => b.percentage - a.percentage)
                      .map((t, idx) => (
                        <div key={`${t.name}-full-${idx}`} className="flex justify-between text-sm">
                          <span>{t.name}</span>
                          <span className="font-mono">{t.percentage.toFixed(3)}%</span>
                        </div>
                      ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

/** Helpers */
function safeParseJSON<T = any>(s: string | null | undefined): T | null {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

function formatPct(v?: number) {
  if (v === undefined || v === null || Number.isNaN(v)) return 'N/A'
  // Show up to 4 decimals if < 1%, else 1 decimal
  if (v < 1) return `${v.toFixed(4)}%`
  return `${v.toFixed(1)}%`
}