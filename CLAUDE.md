# COA Scraper - Cannabis Certificate of Analysis Data Extraction

A Next.js application for automated extraction of cannabis Certificate of Analysis (COA) data from PDF lab results using AI-powered OCR technology.

## Project Overview

**Name:** COA Scraper
**Version:** 0.3.0
**Status:** Production Ready - Enhanced with Multi-Strategy Extraction
**Purpose:** Automate the extraction of key data from cannabis lab result PDFs including THC%, CBD%, terpenes, strain names, and batch IDs using advanced multi-strategy extraction algorithms.

## Technology Stack

### Frontend
- **Next.js 15.5.3** with Turbopack for fast development builds
- **React 19.1.0** for UI components
- **TypeScript 5** for type safety
- **Tailwind CSS 4** for styling
- **React Dropzone 14.3.8** for file upload functionality

### Backend & Database
- **Prisma 6.16.2** as ORM with SQLite/PostgreSQL support
- **Next.js API Routes** for server-side functionality
- **Formidable 3.5.4** for file upload handling
- **PDF-Parse 1.1.1** for PDF text extraction
- **@vercel/postgres** for cloud database deployment
- **@vercel/blob** for cloud file storage

### AI & OCR Processing
- **Mistral AI 1.10.0** with enhanced OCR capabilities
- **Multi-strategy extraction engine** with lab-specific algorithms
- **Advanced text cleaning and pattern recognition**
- **AI-enhanced data validation** with confidence scoring
- **Real-time status tracking** with polling mechanisms

### Development Tools
- **ESLint 9** with Next.js configuration for code quality
- **TypeScript** for static type checking

## Development Commands

### Start Development Server
```bash
npm run dev
```
*Starts Next.js development server with Turbopack for faster builds*

### Build for Production
```bash
npm run build
```
*Creates optimized production build with Turbopack*

### Start Production Server
```bash
npm start
```
*Starts the production server*

### Code Quality
```bash
npm run lint
```
*Runs ESLint to check code quality and formatting*

### Database Commands
```bash
npx prisma generate
npx prisma db push
npx prisma studio
```
*Generate Prisma client, push schema changes, open database browser*

## Project Structure

```
coa-scraper/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout with navigation
│   │   ├── page.tsx           # Homepage with upload interface
│   │   ├── history/           # Processing history page
│   │   ├── results/           # Extraction results display
│   │   │   └── [id]/         # Individual result pages
│   │   ├── globals.css        # Global Tailwind styles
│   │   └── api/               # API routes
│   │       ├── upload/        # File upload endpoint
│   │       ├── documents/     # Document CRUD operations
│   │       │   ├── route.ts   # Document list and creation
│   │       │   ├── [id]/      # Document-specific operations
│   │       │   └── stats/     # Document statistics
│   │       ├── process/       # OCR processing endpoints
│   │       ├── health/        # System health monitoring
│   │       ├── test-db/       # Database connection testing
│   │       └── test-ocr/      # OCR testing endpoint
│   ├── components/            # Reusable React components
│   │   ├── ui/               # UI component library
│   │   │   ├── Button.tsx    # Button component
│   │   │   ├── Card.tsx      # Card component
│   │   │   └── CopyableField.tsx # Copy-to-clipboard fields
│   │   └── coa/              # COA-specific components
│   │       ├── FileUpload.tsx         # Drag-and-drop upload
│   │       ├── UploadStatus.tsx       # Upload progress tracking
│   │       ├── ProcessingStatus.tsx   # OCR processing status
│   │       └── DocumentStats.tsx      # Processing statistics
│   ├── lib/                  # Utility libraries
│   │   ├── prisma.ts         # Prisma client configuration
│   │   ├── fileUpload.ts     # File upload utilities
│   │   ├── processingQueue.ts # Asynchronous processing queue
│   │   ├── dataExtractor.ts  # Multi-strategy data extraction engine
│   │   └── ocr/              # OCR service providers
│   │       ├── ocrService.ts     # Main OCR coordinator
│   │       ├── mistralOCR.ts     # Enhanced Mistral AI integration
│   │       ├── fallbackOCR.ts    # Fallback OCR provider
│   │       └── testOCR.ts        # Testing OCR mock
│   ├── utils/                # Utility functions
│   │   └── csvExport.ts      # CSV export functionality
│   ├── hooks/                # Custom React hooks
│   └── generated/            # Generated code (Prisma client)
├── uploads/                  # File storage directory (gitignored)
├── prisma/
│   ├── schema.prisma         # Database schema definition
│   └── dev.db               # SQLite database file
├── package.json             # Dependencies and scripts
└── README.md               # Project documentation
```

## Database Schema

### CoaDocument Model
The main data model for storing extracted COA information:

**Core Fields:**
- `id` - Unique identifier (CUID)
- `filename` - Stored filename
- `originalName` - Original uploaded filename
- `fileSize` - File size in bytes
- `uploadDate` - Upload timestamp
- `processingStatus` - Processing state (pending/completed/failed)

**Cannabis Data Fields:**
- `batchId` - Product batch identifier
- `strainName` - Cannabis strain/variety name
- `thcPercentage` - THC concentration percentage
- `cbdPercentage` - CBD concentration percentage
- `totalCannabinoids` - Total cannabinoid percentage
- `labName` - Testing laboratory name
- `testDate` - Date of laboratory testing

**OCR & Processing Fields:**
- `rawText` - Extracted text from OCR
- `ocrProvider` - OCR service used
- `confidence` - Extraction confidence score
- `terpenes` - Terpene profile data (JSON string)

**Metadata:**
- `createdAt` - Record creation timestamp
- `updatedAt` - Last update timestamp

## Features

### Current Implementation (Phase 3 Complete)
- ✅ Project setup with Next.js 15 and TypeScript
- ✅ Database schema for COA data storage with PostgreSQL support
- ✅ Responsive UI with Tailwind CSS
- ✅ PDF file upload with drag-and-drop interface
- ✅ Enhanced AI-powered OCR with Mistral AI integration
- ✅ **Multi-strategy data extraction engine** with lab-specific algorithms
- ✅ **Advanced text cleaning and pattern recognition**
- ✅ **Lab-specific extraction strategies** (2River Labs, SC Labs, Steep Hill)
- ✅ **AI-enhanced data validation** with confidence scoring
- ✅ **Copy-to-clipboard functionality** for individual fields and complete data
- ✅ **CSV export functionality** for single and multiple documents
- ✅ Real-time processing status tracking
- ✅ Asynchronous processing queue system
- ✅ Processing history and document management
- ✅ Multi-provider OCR with fallback mechanisms
- ✅ Comprehensive error handling and retry logic
- ✅ Type-safe architecture throughout
- ✅ Enhanced cannabinoid extraction accuracy
- ✅ Terpene profile extraction with validation
- ✅ Cloud database and storage integration (Vercel)

### Planned Features (Phase 4)
- 🚧 Advanced search and filtering capabilities
- 🚧 Batch processing for multiple documents
- 🚧 User authentication and role management
- 🚧 API rate limiting and caching
- 🚧 Advanced analytics and reporting dashboard
- 🚧 Document comparison and validation tools
- 🚧 Integration with external lab systems
- 🚧 Excel export functionality
- 🚧 Automated data quality scoring
- 🚧 Mobile-responsive design improvements

## Data Extraction Capabilities

The system uses a **multi-strategy extraction engine** to maximize accuracy across different lab formats:

### Extraction Strategies
1. **Lab-Specific Strategies** - Optimized patterns for known labs:
   - **2River Labs** - Specialized EVM batch ID extraction, SAMPLE line parsing
   - **SC Labs** - Pattern recognition for their specific format
   - **Steep Hill** - Tailored extraction for their COA layout

2. **Structured Pattern Extraction** - Identifies organized data sections
3. **Numerical Analysis** - Validates cannabinoid values against expected ranges
4. **Contextual Search** - Finds values near cannabinoid keywords
5. **AI Enhancement** - Uses Mistral AI for complex or ambiguous cases

### Extracted Data Points
- **Batch Identifiers** - Unique product tracking numbers (EVM####, etc.)
- **Strain Names** - Cannabis variety/product names from sample lines
- **Cannabinoid Profiles** - THC%, CBD%, and total cannabinoid percentages
- **Category & Sub-Category** - Product classification (INHALABLE, FLOWER, etc.)
- **Terpene Profiles** - Top terpenes with percentages and validation
- **Lab Information** - Testing facility details and test dates
- **Confidence Scoring** - Quality assessment of extracted data

### Advanced Text Processing
- **OCR Text Cleaning** - Fixes common character recognition errors
- **Pattern Normalization** - Standardizes spacing and formatting
- **Data Validation** - Ensures extracted values are within realistic ranges
- **Multi-Provider Fallback** - Uses backup OCR services for difficult documents

## API Endpoints

### File Upload & Management
- `POST /api/upload` - Upload PDF files for processing
- `GET /api/documents` - List all uploaded documents with pagination
- `GET /api/documents/[id]` - Get specific document details with extracted data
- `DELETE /api/documents/[id]` - Delete document and associated data
- `GET /api/documents/stats` - Get processing statistics and analytics

### Processing & OCR
- `POST /api/process/[id]` - Trigger multi-strategy OCR processing for uploaded document
- `GET /api/test-ocr` - Test OCR functionality with sample data

### System Health & Testing
- `GET /api/health` - System health monitoring with OCR service status
- `GET /api/test-db` - Test database connectivity with sample data creation
- `DELETE /api/test-db` - Clean up test data

### User Interface Features
- **Individual Result Pages** - `/results/[id]` - Detailed view of extracted data
- **Copy-to-Clipboard** - Individual field copying and bulk data export
- **CSV Export** - Single document and batch export functionality
- **Processing History** - Complete audit trail of document processing

## Configuration

### Environment Variables
- `DATABASE_URL` - Prisma database connection string (SQLite/PostgreSQL)
- `POSTGRES_URL` - PostgreSQL connection for production (Vercel)
- `NODE_ENV` - Environment setting (development/production)
- `MISTRAL_API_KEY` - Mistral AI API key for enhanced OCR processing
- `UPLOAD_DIR` - Directory for storing uploaded files (default: ./uploads)
- `OCR_MAX_FILE_SIZE` - Maximum file size for OCR processing (default: 50MB)
- `OCR_TIMEOUT` - OCR processing timeout in milliseconds (default: 2 minutes)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token for cloud file storage

### Database Configuration
- **Provider:** SQLite (development) / PostgreSQL (production)
- **ORM:** Prisma with generated TypeScript client
- **Connection:** File-based SQLite (`prisma/dev.db`) or cloud PostgreSQL
- **Cloud Storage:** Vercel Blob for production file storage

## Development Workflow

1. **Start Development:**
   ```bash
   npm run dev
   ```

2. **Database Changes:**
   ```bash
   npx prisma db push    # Apply schema changes
   npx prisma generate   # Update Prisma client
   ```

3. **Code Quality:**
   ```bash
   npm run lint          # Check code quality
   ```

4. **Build & Test:**
   ```bash
   npm run build         # Production build
   ```

## Processing Workflow

### 1. File Upload
- User uploads PDF via drag-and-drop interface
- File validation (PDF format, size limits up to 50MB)
- Secure storage in uploads directory or cloud storage
- Database record creation with metadata

### 2. Enhanced OCR Processing
- Asynchronous processing queue triggered
- **Advanced text cleaning** - Character correction, spacing normalization
- **Mistral OCR integration** - Base64 encoding and cloud processing
- **Multiple extraction strategies** executed in parallel
- Fallback OCR providers for reliability

### 3. Multi-Strategy Data Extraction
- **Lab detection** - Identifies specific lab format (2River, SC Labs, etc.)
- **Strategy execution** - Runs lab-specific and generic extraction methods
- **Confidence scoring** - Each strategy provides accuracy assessment
- **Result combination** - Intelligently merges best results from all strategies
- **AI enhancement** - Uses Mistral AI for low-confidence extractions

### 4. Data Validation & Storage
- **Range validation** - Ensures cannabinoid values are realistic
- **Cross-validation** - Checks THC vs total cannabinoids consistency
- **Terpene validation** - Validates terpene names and percentages
- **Final confidence calculation** - Comprehensive accuracy scoring
- JSON formatting and database storage with metadata

### 5. User Experience Features
- Real-time processing status updates
- **Copy-to-clipboard** functionality for all extracted fields
- **CSV export** for individual documents or batch downloads
- Processing history with detailed extraction logs
- Error handling and retry capabilities

## Notes for Claude Code

- Always run `npm run lint` after making code changes
- Use `npx prisma generate` after schema modifications
- The project uses Turbopack for faster builds in development
- Set `MISTRAL_API_KEY` environment variable for enhanced OCR functionality
- OCR processing is asynchronous with real-time status polling
- **Multi-strategy extraction** requires comprehensive testing across lab formats
- **Text cleaning algorithms** are crucial for extraction accuracy
- Database supports both SQLite (development) and PostgreSQL (production)
- File uploads are handled with formidable for multipart form data
- **CSV export functionality** requires client-side blob handling
- All processing operations include comprehensive error handling and retry logic
- **Copy-to-clipboard features** use modern Clipboard API
- Production deployment uses Vercel with cloud database and storage

## Recent Major Improvements

### Enhanced Data Extraction (Version 0.3.0)

- **Multi-strategy extraction engine** with lab-specific algorithms
- **Advanced OCR text cleaning** with character error correction
- **2River Labs specific extraction** with EVM batch ID recognition
- **Intelligent result combination** from multiple extraction strategies
- **AI-enhanced validation** for complex or ambiguous documents

### User Experience Enhancements

- **Copy-to-clipboard functionality** for individual fields and complete data sets
- **CSV export capabilities** for single documents and batch processing
- **Enhanced confidence scoring** with detailed extraction method tracking
- **Improved error handling** with detailed diagnostic logging

### Technical Infrastructure

- **Cloud deployment ready** with PostgreSQL and Vercel Blob support
- **Advanced environment configuration** with configurable timeouts and limits
- **Comprehensive API documentation** with detailed endpoint specifications

## Project Status

This is a **production-ready application** with complete Phase 3 implementation. The system successfully processes cannabis COA PDFs using advanced multi-strategy extraction algorithms, providing industry-leading accuracy for cannabinoid data extraction with comprehensive user experience features including copy-to-clipboard and CSV export functionality.