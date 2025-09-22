import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get status counts
    const statusCounts = await prisma.coaDocument.groupBy({
      by: ['processingStatus'],
      _count: {
        processingStatus: true
      }
    })

    // Get total count
    const totalCount = await prisma.coaDocument.count()

    // Format status counts
    const counts = {
      total: totalCount,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    }

    statusCounts.forEach(item => {
      if (item.processingStatus in counts) {
        counts[item.processingStatus as keyof typeof counts] = item._count.processingStatus
      }
    })

    return NextResponse.json({
      success: true,
      data: counts
    })

  } catch (error) {
    console.error('Error fetching document stats:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}