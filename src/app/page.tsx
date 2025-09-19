export default function HomePage() {
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

      {/* Upload Section Placeholder */}
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Upload COA Documents
          </h3>
          <p className="text-gray-600 mb-4">
            Drag and drop your PDF files here or click to browse
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12">
            <p className="text-gray-500">
              🚧 File upload component coming in Phase 2!
            </p>
          </div>
        </div>
      </div>

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