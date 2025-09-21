'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface ProcessingData {
  id: string
  processingStatus: string
  confidence?: number
  ocrProvider?: string
  extractedData?: {
    batchId?: string
    strainName?: string
    thcPercentage?: number
    cbdPercentage?: number
    totalCannabinoids?: number
    terpenes?: Array<{ name: string; percentage: number }>
  }
}

interface ProcessingStatusProps {
  documentId: string
  onProcessingComplete?: (data: ProcessingData) => void
  onProcessingFailed?: (error: string) => void
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  documentId,
  onProcessingComplete,
  onProcessingFailed
}) => {
  const [status, setStatus] = useState<string>('checking')
  const [progress, setProgress] = useState(0)
  const [data, setData] = useState<ProcessingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (documentId) {
      checkProcessingStatus()
    }
  }, [documentId])

  const checkProcessingStatus = async () => {
    try {
      const response = await fetch(`/api/process/${documentId}`)
      const result = await response.json()

      if (result.success && result.data) {
        const newStatus = result.data.processingStatus
        setStatus(newStatus)
        setData(result.data)

        // Update progress based on status
        switch (newStatus) {
          case 'pending':
            setProgress(10)
            setTimeout(checkProcessingStatus, 2000) // Check again in 2s
            break
          case 'processing':
            setProgress(50)
            setTimeout(checkProcessingStatus, 3000) // Check again in 3s
            break
          case 'completed':
            setProgress(100)
            onProcessingComplete?.(result.data)
            break
          case 'failed':
            setProgress(0)
            setError(result.data.error || 'Processing failed')
            onProcessingFailed?.(result.data.error || 'Processing failed')
            break
        }
      } else {
        throw new Error(result.error || 'Failed to check status')
      }
    } catch (err) {
      console.error('Status check error:', err)
      setError(err instanceof Error ? err.message : 'Status check failed')
      
      // Retry up to 3 times
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
          checkProcessingStatus()
        }, 5000)
      }
    }
  }

  const retryProcessing = async () => {
    setError(null)
    setRetryCount(0)
    setStatus('processing')
    setProgress(10)

    try {
      const response = await fetch(`/api/process/${documentId}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        checkProcessingStatus()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Retry failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'processing':
        return (
          <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 animate-pulse text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Queued for processing...'
      case 'processing':
        return 'Extracting data with OCR...'
      case 'completed':
        return 'Processing complete!'
      case 'failed':
        return 'Processing failed'
      default:
        return 'Checking status...'
    }
  }

  if (status === 'completed' && data?.extractedData) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-green-800">
              {getStatusIcon()}
              <span className="ml-2">Extraction Complete</span>
              {data.confidence && (
                <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                  {data.confidence}% confidence
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.extractedData.batchId && (
              <div>
                <span className="font-medium text-gray-700">Batch ID:</span>
                <span className="ml-2 text-gray-900">{data.extractedData.batchId}</span>
              </div>
            )}
            
            {data.extractedData.strainName && (
              <div>
                <span className="font-medium text-gray-700">Strain:</span>
                <span className="ml-2 text-gray-900">{data.extractedData.strainName}</span>
              </div>
            )}
            
            {data.extractedData.thcPercentage !== undefined && (
              <div>
                <span className="font-medium text-gray-700">THC:</span>
                <span className="ml-2 text-gray-900">{data.extractedData.thcPercentage}%</span>
              </div>
            )}
            
            {data.extractedData.cbdPercentage !== undefined && (
              <div>
                <span className="font-medium text-gray-700">CBD:</span>
                <span className="ml-2 text-gray-900">{data.extractedData.cbdPercentage}%</span>
              </div>
            )}
          </div>

          {data.extractedData.terpenes && data.extractedData.terpenes.length > 0 && (
            <div className="mt-4">
              <span className="font-medium text-gray-700">Top Terpenes:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.extractedData.terpenes.slice(0, 5).map((terpene, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                  >
                    {terpene.name}: {terpene.percentage}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.ocrProvider && (
            <div className="mt-4 text-xs text-gray-500">
              Processed with {data.ocrProvider}
            </div>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className={error ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}>
      <CardHeader>
        <CardTitle className={`flex items-center ${error ? 'text-red-800' : 'text-blue-800'}`}>
          {getStatusIcon()}
          <span className="ml-2">{getStatusText()}</span>
        </CardTitle>
      </CardHeader>
      
      <div className="px-6 pb-6">
        {/* Progress Bar */}
        {!error && status !== 'completed' && (
          <div className="mb-4">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {progress}% complete
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4">
            <p className="text-sm text-red-700 mb-3">{error}</p>
            <Button
              onClick={retryProcessing}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-300 hover:bg-red-100"
            >
              Retry Processing
            </Button>
          </div>
        )}

        {/* Processing Info */}
        {status === 'processing' && (
          <div className="text-sm text-blue-700">
            <p>Using AI-powered OCR to extract:</p>
            <ul className="list-disc list-inside mt-1 text-xs">
              <li>Batch ID and strain information</li>
              <li>THC and CBD percentages</li>
              <li>Terpene profiles</li>
              <li>Lab and testing details</li>
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}