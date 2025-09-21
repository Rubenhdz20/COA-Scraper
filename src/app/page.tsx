'use client'

import React, { useState } from 'react'
import { FileUpload } from '@/components/coa/FileUpload'
import { UploadStatus } from '@/components/coa/UploadStatus'

interface UploadedFile {
  id: string
  name: string
  size: number
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  progress?: number
  uploadedAt: Date
}

export default function HomePage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileUpload = async (file: File) => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Add file to the list with uploading status
    const newFile: UploadedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
      uploadedAt: new Date()
    }
    
    setUploadedFiles(prev => [...prev, newFile])
    setIsProcessing(true)

    try {
      // Use the real upload API
      const { uploadFile } = await import('@/lib/fileUpload')
      
      const result = await uploadFile(file, (progress) => {
        setUploadedFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: progress.percentage } : f)
        )
      })

      if (result.success && result.data) {
        // Update with real document ID from server
        setUploadedFiles(prev =>
          prev.map(f => f.id === fileId ? { 
            ...f, 
            id: result.data!.id, // Use real ID from server
            status: 'processing' 
          } : f)
        )

        // Trigger OCR processing
        const { triggerProcessing } = await import('@/lib/processingQueue')
        const processingResult = await triggerProcessing(result.data.id)

        if (processingResult.success) {
          // Start polling for processing status
          const { pollProcessingStatus } = await import('@/lib/processingQueue')
          
          pollProcessingStatus(
            result.data.id,
            (status, data) => {
              setUploadedFiles(prev =>
                prev.map(f => f.id === result.data!.id ? { 
                  ...f, 
                  status: status as UploadedFile['status']
                } : f)
              )

              if (status === 'completed' || status === 'failed') {
                setIsProcessing(false)
              }
            }
          )
        } else {
          throw new Error(processingResult.message || 'Processing failed')
        }

      } else {
        throw new Error(result.error || 'Upload failed')
      }

    } catch (error) {
      console.error('Upload failed:', error)
      setUploadedFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, status: 'failed' } : f)
      )
      setIsProcessing(false)
    }
  }

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const handleRetryFile = async (fileId: string) => {
    // Find the file and re-trigger processing
    const file = uploadedFiles.find(f => f.id === fileId)
    if (file) {
      // Update status to processing
      setUploadedFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f)
      )

      try {
        const { triggerProcessing } = await import('@/lib/processingQueue')
        const processingResult = await triggerProcessing(fileId)

        if (processingResult.success) {
          // Start polling again
          const { pollProcessingStatus } = await import('@/lib/processingQueue')
          
          pollProcessingStatus(
            fileId,
            (status, data) => {
              setUploadedFiles(prev =>
                prev.map(f => f.id === fileId ? { 
                  ...f, 
                  status: status as UploadedFile['status']
                } : f)
              )
            }
          )
        } else {
          throw new Error(processingResult.message || 'Retry failed')
        }
      } catch (error) {
        console.error('Retry failed:', error)
        setUploadedFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, status: 'failed' } : f)
        )
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Cannabis COA Data Extraction
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Upload your Certificate of Analysis (COA) PDFs and automatically extract 
          key data including THC%, CBD%, terpenes, strain names, and batch IDs.
        </p>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">Fast</div>
            <div className="text-sm text-gray-600 mt-1">
              Process COAs in seconds with AI-powered OCR
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">Accurate</div>
            <div className="text-sm text-gray-600 mt-1">
              High-precision extraction with confidence scoring
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">Automated</div>
            <div className="text-sm text-gray-600 mt-1">
              No manual data entry required
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      <FileUpload 
        onFileUpload={handleFileUpload}
        isProcessing={isProcessing}
      />

      {/* Upload Status */}
      <UploadStatus
        files={uploadedFiles}
        onRemoveFile={handleRemoveFile}
        onRetryFile={handleRetryFile}
      />

      {/* Supported Data Section */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-4">
          Data We Extract
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="font-medium text-blue-800">Batch ID</div>
            <div className="text-sm text-blue-600">Unique identifiers</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-blue-800">Strain Name</div>
            <div className="text-sm text-blue-600">Product varieties</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-blue-800">Cannabinoids</div>
            <div className="text-sm text-blue-600">THC%, CBD%, etc.</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-blue-800">Terpenes</div>
            <div className="text-sm text-blue-600">Flavor profiles</div>
          </div>
        </div>
      </div>
    </div>
  )
}