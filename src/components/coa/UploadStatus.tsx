'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface UploadedFile {
  id: string
  name: string
  size: number
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  progress?: number
  uploadedAt: Date
}

interface UploadStatusProps {
  files: UploadedFile[]
  onRemoveFile: (id: string) => void
  onRetryFile: (id: string) => void
}

export const UploadStatus: React.FC<UploadStatusProps> = ({
  files,
  onRemoveFile,
  onRetryFile
}) => {
  const router = useRouter()

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      case 'processing':
        return (
          <svg className="w-5 h-5 animate-pulse text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    }
  }

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return 'Extracting data...'
      case 'completed':
        return 'Complete'
      case 'failed':
        return 'Failed'
    }
  }

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'text-blue-600'
      case 'processing':
        return 'text-yellow-600'
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
    }
  }

  const handleViewResults = (fileId: string) => {
    router.push(`/results/${fileId}`)
  }

  if (files.length === 0) {
    return null
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Upload Status</CardTitle>
      </CardHeader>
      
      <div className="space-y-4 p-4">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
          >
            {/* File Info */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* PDF Icon */}
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
              </div>

              {/* File Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{file.uploadedAt.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(file.status)}
                <span className={`text-sm font-medium ${getStatusColor(file.status)}`}>
                  {getStatusText(file.status)}
                </span>
              </div>

              {/* Progress Bar for uploading */}
              {file.status === 'uploading' && file.progress !== undefined && (
                <div className="w-20">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2">
                {file.status === 'failed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRetryFile(file.id)}
                  >
                    Retry
                  </Button>
                )}
                
                {file.status === 'completed' && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleViewResults(file.id)}
                  >
                    View Results
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRemoveFile(file.id)}
                  className="text-gray-500 hover:text-red-600"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}