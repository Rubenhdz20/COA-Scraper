import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'

// GET handler (keep your existing one)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Fetch the document from database
    const document = await prisma.coaDocument.findUnique({
      where: { id }
    })

    if (!document) {
      return NextResponse.json({
        success: false,
        error: 'Document not found'
      }, { status: 404 })
    }

    // Parse terpenes if they exist
    let parsedTerpenes = null
    if (document.terpenes) {
      try {
        parsedTerpenes = JSON.parse(document.terpenes)
      } catch (e) {
        console.error('Error parsing terpenes:', e)
      }
    }

    // Return the document data
    return NextResponse.json({
      success: true,
      data: {
        ...document,
        terpenes: parsedTerpenes
      }
    })

  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE handler (new)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    console.log('Deleting document ID:', id)

    // First, find the document to get the file path
    const document = await prisma.coaDocument.findUnique({
      where: { id }
    })

    if (!document) {
      return NextResponse.json({
        success: false,
        error: 'Document not found'
      }, { status: 404 })
    }

    // Delete the physical file if it exists
    if (document.filename && existsSync(document.filename)) {
      try {
        await unlink(document.filename)
        console.log('File deleted:', document.filename)
      } catch (fileError) {
        console.error('Error deleting file:', fileError)
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the database record
    await prisma.coaDocument.delete({
      where: { id }
    })

    console.log('Document deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}