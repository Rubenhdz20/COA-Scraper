'use client'

import React, { useState } from 'react'

interface CopyableFieldProps {
  label: string
  value: string | number | null | undefined
  className?: string
}

export const CopyableField: React.FC<CopyableFieldProps> = ({
  label,
  value,
  className = ""
}) => {
  const [copied, setCopied] = useState(false)
  
  const displayValue = value?.toString() || 'N/A'
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className={`group ${className}`}>
      <span className="text-gray-600 text-sm">{label}:</span>
      <div className="flex items-center space-x-2 mt-1">
        <div 
          className="font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded border cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors select-all"
          onClick={handleCopy}
          title="Click to copy"
        >
          {displayValue}
        </div>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// Component for copying all data at once
interface CopyAllDataProps {
  data: {
    batchId?: string
    strainName?: string
    category?: string
    subCategory?: string
    thcPercentage?: number
    cbdPercentage?: number
    totalCannabinoids?: number
    labName?: string
    testDate?: string
    terpenes?: Array<{ name: string; percentage: number }>
  }
}

export const CopyAllData: React.FC<CopyAllDataProps> = ({ data }) => {
  const [copied, setCopied] = useState(false)

  const formatAllData = () => {
    const formatTerpenes = (terpenes?: Array<{ name: string; percentage: number }>) => {
      if (!terpenes || terpenes.length === 0) return 'N/A'
      return terpenes.map(t => `${t.name}: ${t.percentage}%`).join(', ')
    }

    const formatDate = (dateString?: string) => {
      if (!dateString) return 'N/A'
      try {
        return new Date(dateString).toLocaleDateString()
      } catch {
        return dateString
      }
    }

    return [
      `Batch ID: ${data.batchId || 'N/A'}`,
      `Strain: ${data.strainName || 'N/A'}`,
      `Category: ${data.category || 'N/A'}`,
      `Sub-Category: ${data.subCategory || 'N/A'}`,
      `THC: ${data.thcPercentage || 'N/A'}%`,
      `CBD: ${data.cbdPercentage || 'N/A'}%`,
      `Total Cannabinoids: ${data.totalCannabinoids || 'N/A'}%`,
      `Lab: ${data.labName || 'N/A'}`,
      `Test Date: ${formatDate(data.testDate)}`,
      `Terpenes: ${formatTerpenes(data.terpenes)}`
    ].join('\n')
  }

  const handleCopyAll = async () => {
    try {
      const allData = formatAllData()
      await navigator.clipboard.writeText(allData)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error('Failed to copy all data:', err)
    }
  }

  return (
    <button
      onClick={handleCopyAll}
      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copy All Data</span>
        </>
      )}
    </button>
  )
}