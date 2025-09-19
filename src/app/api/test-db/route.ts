import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Simple connection test
    await prisma.$connect()
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful!'
    })
  } catch (error) {
    console.error('Database connection error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}