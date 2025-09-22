'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'

interface StatsData {
  total: number
  completed: number
  processing: number
  pending: number
  failed: number
}

interface StatsResponse {
  success: boolean
  data: StatsData
  error?: string
}

export const DocumentStats: React.FC = () => {
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    completed: 0,
    processing: 0,
    pending: 0,
    failed: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/documents/stats')
        const data: StatsResponse = await response.json()

        if (data.success) {
          setStats(data.data)
          setError(null)
        } else {
          setError(data.error || 'Failed to fetch stats')
        }
      } catch (err) {
        console.error('Error fetching stats:', err)
        setError('Network error while fetching stats')
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-700">Error loading stats: {error}</p>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Documents',
      value: stats.total,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Completed',
      value: stats.completed,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Processing',
      value: stats.processing + stats.pending, // Combine processing and pending
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Failed',
      value: stats.failed,
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