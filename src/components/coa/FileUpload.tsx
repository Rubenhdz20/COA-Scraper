'use client'

import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface FileUploadProps {
  onFileUpload: (file: File) => void
  isProcessing?: boolean
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUpload, 
  isProcessing = false 
}) => {
  const [dragActive, setDragActive] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setUploadError(null)
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setUploadError('File is too large. Maximum size is 10MB.')
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setUploadError('Only PDF files are allowed.')
      } else {
        setUploadError('File upload failed. Please try again.')
      }
      return
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      onFileUpload(file)
    }
  }, [onFileUpload])

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: isProcessing,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false)
  })

  const getBorderColor = () => {
    if (isProcessing) return 'border-gray-300'
    if (isDragReject) return 'border-red-400'
    if (isDragActive) return 'border-blue-400'
    return 'border-gray-300'
  }

  const getBackgroundColor = () => {
    if (isProcessing) return 'bg-gray-50'
    if (isDragReject) return 'bg-red-50'
    if (isDragActive) return 'bg-blue-50'
    return 'bg-white'
  }

  const getTextColor = () => {
    if (isProcessing) return 'text-gray-500'
    if (isDragReject) return 'text-red-600'
    if (isDragActive) return 'text-blue-600'
    return 'text-gray-600'
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${getBorderColor()}
          ${getBackgroundColor()}
          ${isProcessing ? 'cursor-not-allowed' : 'hover:border-blue-400 hover:bg-blue-50'}
        `}
      >
        <input {...getInputProps()} />
        
        {/* Upload Icon */}
        <div className="w-16 h-16 mx-auto mb-4">
          {isProcessing ? (
            <svg className="w-16 h-16 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg 
              className={`w-16 h-16 ${getTextColor()}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
          )}
        </div>

        {/* Upload Text */}
        <div className="space-y-2">
          {isProcessing ? (
            <>
              <h3 className="text-lg font-medium text-gray-900">Processing...</h3>
              <p className="text-gray-600">Extracting data from your COA document</p>
            </>
          ) : isDragActive ? (
            <>
              <h3 className="text-lg font-medium text-blue-900">Drop your COA here</h3>
              <p className="text-blue-600">Release to upload the PDF file</p>
            </>
          ) : isDragReject ? (
            <>
              <h3 className="text-lg font-medium text-red-900">Invalid file type</h3>
              <p className="text-red-600">Only PDF files are accepted</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900">
                Upload COA Document
              </h3>
              <p className={getTextColor()}>
                Drag and drop your PDF file here, or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF files up to 10MB
              </p>
            </>
          )}
        </div>

        {/* Browse Button */}
        {!isProcessing && !isDragActive && (
          <div className="mt-6">
            <Button
              variant="outline"
              size="lg"
              className="mx-auto"
            >
              Browse Files
            </Button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <svg 
              className="w-5 h-5 text-red-400 mt-0.5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700">{uploadError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Supported File Types */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Supported Lab Formats
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>• 2 River Labs</div>
          <div>• SC Labs</div>
          <div>• CannaSafe</div>
          <div>• More formats coming...</div>
        </div>
      </div>
    </Card>
  )
}