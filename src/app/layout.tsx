// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'COA Scraper - Cannabis Lab Results Extraction',
  description: 'Automated extraction of cannabis Certificate of Analysis (COA) data from PDF lab results',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  COA Scraper
                </h1>
                <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                  Beta
                </span>
              </div>
              <div className="flex space-x-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Upload
                </Link>
                <a href="/history" className="text-gray-600 hover:text-gray-900 transition-colors">
                  History
                </a>
              </div>
            </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t mt-auto">
            <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
              <p className="text-center text-sm text-gray-500">
                COA Scraper - Automated Cannabis Lab Results Processing
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}