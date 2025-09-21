'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'

interface StatsData {
  totalDocuments: number
  completedDocuments: number
  processingDocuments: number
  failedDocuments: number
}

export const DocumentStats: React.FC = () => {
  const [stats, setStats] = useState<StatsData>({
    totalDocuments: 0,
    completedDocuments: 0,
    processingDocuments: 0,
    failedDocuments: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch documents with different statuses to calculate stats
        const [completed, processing, failed] = await Promise.all([
          fetch('/api/documents?status=completed'),
          fetch('/api/documents?status=processing'),
          fetch('/api/documents?status=failed')
        ])

        const [completedData, processingData, failedData] = await Promise.all([
          completed.json(),
          processing.json(),
          failed.json()
        ])

        if (completedData.success && processingData.success && failedData.success) {
          const completedCount = completedData.data?.pagination?.totalCount || 0
          const processingCount = processingData.data?.pagination?.totalCount || 0
          const failedCount = failedData.data?.pagination?.totalCount || 0

          setStats({
            totalDocuments: completedCount + processingCount + failedCount,
            completedDocuments: completedCount,
            processingDocuments: processingCount,
            failedDocuments: failedCount
          })
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Documents',
      value: stats.totalDocuments,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Completed',
      value: stats.completedDocuments,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Processing',
      value: stats.processingDocuments,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Failed',
      value: stats.failedDocuments,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className={`${stat.bgColor} border-none`}>
          <div className="text-center p-4">
            <div className={`text-3xl font-bold ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {stat.title}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}