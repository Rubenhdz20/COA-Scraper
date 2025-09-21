import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Filter parameters
    const status = searchParams.get('status')
    const strainName = searchParams.get('strain')

    // Build where clause
    const where: any = {}
    if (status) {
      where.processingStatus = status
    }
    if (strainName) {
      where.strainName = {
        contains: strainName,
        mode: 'insensitive'
      }
    }

    // Get documents with pagination
    const [documents, totalCount] = await Promise.all([
      prisma.coaDocument.findMany({
        where,
        select: {
          id: true,
          filename: true,
          originalName: true,
          fileSize: true,
          processingStatus: true,
          uploadDate: true,
          batchId: true,
          strainName: true,
          thcPercentage: true,
          cbdPercentage: true,
          confidence: true,
          createdAt: true
        },
        orderBy: {
          uploadDate: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.coaDocument.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      data: {
        documents,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      }
    })

  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}