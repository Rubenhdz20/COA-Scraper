// src/app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Get query parameters
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Build where clause based on filters
    const where: any = {}
    if (status) {
      where.processingStatus = status
    }

    // Get total count for pagination
    const totalCount = await prisma.coaDocument.count({ where })

    // Get documents with filters and pagination
    const documents = await prisma.coaDocument.findMany({
      where,
      orderBy: {
        uploadDate: 'desc'
      },
      skip: offset,
      take: limit,
      select: {
        id: true,
        originalName: true,
        filePath: true,  // Add filePath
        fileSize: true,
        uploadDate: true,
        processingStatus: true,
        confidence: true,
        batchId: true,
        strainName: true,
        category: true,
        subCategory: true,
        thcPercentage: true,
        cbdPercentage: true,
        totalCannabinoids: true,
        labName: true,
        testDate: true,
        ocrProvider: true
      }
    })

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    // Get status counts for the dashboard
    const statusCounts = await prisma.coaDocument.groupBy({
      by: ['processingStatus'],
      _count: {
        processingStatus: true
      }
    })

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
      data: {
        documents: documents.map(doc => ({
          ...doc,
          filename: doc.filePath, // Map filePath to filename for compatibility
          createdAt: doc.uploadDate // Map uploadDate to createdAt for compatibility
        })),
        pagination: {
          currentPage: page,  // Changed from 'page' to 'currentPage'
          limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage: hasPrevPage  // Changed to match your component
        },
        counts
      }
    })

  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}