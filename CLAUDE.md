# COA Scraper - Cannabis Certificate of Analysis Data Extraction

A Next.js application for automated extraction of cannabis Certificate of Analysis (COA) data from PDF lab results using AI-powered OCR technology.

## Project Overview

**Name:** COA Scraper
**Version:** 0.2.0
**Status:** Beta - Functional with OCR Processing
**Purpose:** Automate the extraction of key data from cannabis lab result PDFs including THC%, CBD%, terpenes, strain names, and batch IDs.

## Technology Stack

### Frontend
- **Next.js 15.5.3** with Turbopack for fast development builds
- **React 19.1.0** for UI components
- **TypeScript 5** for type safety
- **Tailwind CSS 4** for styling
- **React Dropzone 14.3.8** for file upload functionality

### Backend & Database
- **Prisma 6.16.2** as ORM with SQLite database
- **Next.js API Routes** for server-side functionality
- **Formidable 3.5.4** for file upload handling
- **PDF-Parse 1.1.1** for PDF text extraction

### AI & OCR Processing
- **Mistral AI 1.10.0** for advanced language model processing
- **Multi-provider OCR system** with fallback mechanisms
- **Asynchronous processing queue** for document workflow
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
│   │   ├── globals.css        # Global Tailwind styles
│   │   └── api/               # API routes
│   │       ├── upload/        # File upload endpoint
│   │       ├── documents/     # Document CRUD operations
│   │       ├── process/       # OCR processing endpoints
│   │       ├── health/        # System health monitoring
│   │       ├── test-db/       # Database connection testing
│   │       └── test-ocr/      # OCR testing endpoint
│   ├── components/            # Reusable React components
│   │   ├── ui/               # UI component library
│   │   │   ├── Button.tsx    # Button component
│   │   │   └── Card.tsx      # Card component
│   │   └── coa/              # COA-specific components
│   │       ├── FileUpload.tsx         # Drag-and-drop upload
│   │       ├── UploadStatus.tsx       # Upload progress tracking
│   │       ├── ProcessingStatus.tsx   # OCR processing status
│   │       └── DocumentStats.tsx      # Processing statistics
│   ├── lib/                  # Utility libraries
│   │   ├── prisma.ts         # Prisma client configuration
│   │   ├── fileUpload.ts     # File upload utilities
│   │   ├── processingQueue.ts # Asynchronous processing queue
│   │   ├── dataExtractor.ts  # AI-powered data extraction
│   │   └── ocr/              # OCR service providers
│   │       ├── ocrService.ts     # Main OCR coordinator
│   │       ├── mistralOCR.ts     # Mistral AI integration
│   │       ├── fallbackOCR.ts    # Fallback OCR provider
│   │       └── testOCR.ts        # Testing OCR mock
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Utility functions
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

### Current Implementation (Phase 2 Complete)
- ✅ Project setup with Next.js 15 and TypeScript
- ✅ Database schema for COA data storage
- ✅ Responsive UI with Tailwind CSS
- ✅ PDF file upload with drag-and-drop interface
- ✅ AI-powered OCR for text extraction (Mistral AI)
- ✅ Data parsing and cannabis-specific field extraction
- ✅ Confidence scoring for extracted data
- ✅ Real-time processing status tracking
- ✅ Asynchronous processing queue system
- ✅ Processing history and document management
- ✅ Multi-provider OCR with fallback mechanisms
- ✅ Comprehensive error handling and retry logic
- ✅ Type-safe architecture throughout

### Planned Features (Phase 3)
- 🚧 Export functionality (CSV, JSON, Excel)
- 🚧 Advanced search and filtering capabilities
- 🚧 Batch processing for multiple documents
- 🚧 User authentication and role management
- 🚧 API rate limiting and caching
- 🚧 Advanced analytics and reporting
- 🚧 Document comparison and validation tools
- 🚧 Integration with external lab systems

## Data Extraction Capabilities

The system is designed to extract the following data points from COA PDFs:
- **Batch Identifiers** - Unique product tracking numbers
- **Strain Names** - Cannabis variety/product names
- **Cannabinoid Profiles** - THC%, CBD%, and other cannabinoid percentages
- **Terpene Profiles** - Flavor and aroma compound data
- **Lab Information** - Testing facility details and test dates
- **Compliance Data** - Regulatory compliance information

## API Endpoints

### File Upload & Management
- `POST /api/upload` - Upload PDF files for processing
- `GET /api/documents` - List all uploaded documents
- `GET /api/documents/[id]` - Get specific document details
- `DELETE /api/documents/[id]` - Delete document and associated data

### Processing & OCR
- `POST /api/process/[id]` - Trigger OCR processing for uploaded document
- `GET /api/test-ocr` - Test OCR functionality with sample data

### System Health & Testing
- `GET /api/health` - System health monitoring
- `GET /api/test-db` - Test database connectivity with sample data creation
- `DELETE /api/test-db` - Clean up test data

## Configuration

### Environment Variables
- `DATABASE_URL` - Prisma database connection string (SQLite)
- `NODE_ENV` - Environment setting (development/production)
- `MISTRAL_API_KEY` - Mistral AI API key for OCR processing
- `UPLOAD_DIR` - Directory for storing uploaded files (default: ./uploads)

### Database Configuration
- **Provider:** SQLite (for development)
- **ORM:** Prisma with generated TypeScript client
- **Connection:** File-based SQLite database in `prisma/dev.db`

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
- File validation (PDF format, size limits)
- Secure storage in uploads directory
- Database record creation with metadata

### 2. OCR Processing
- Asynchronous processing queue triggered
- PDF text extraction using pdf-parse
- AI-powered content analysis with Mistral AI
- Fallback OCR providers for reliability

### 3. Data Extraction
- Cannabis-specific field identification
- Structured data extraction (THC%, CBD%, terpenes, etc.)
- Confidence scoring for each extracted field
- JSON formatting and database storage

### 4. Status Tracking
- Real-time processing status updates
- Polling mechanism for frontend updates
- Error handling and retry capabilities
- Completion notifications

## Notes for Claude Code

- Always run `npm run lint` after making code changes
- Use `npx prisma generate` after schema modifications
- The project uses Turbopack for faster builds in development
- Set `MISTRAL_API_KEY` environment variable for OCR functionality
- OCR processing is asynchronous with real-time status polling
- Database is currently SQLite for development; production may use PostgreSQL
- File uploads are handled with formidable for multipart form data
- All processing operations include comprehensive error handling

## Project Status

This is a **fully functional beta application** with complete Phase 2 implementation. The system successfully processes cannabis COA PDFs from upload through AI-powered data extraction, with real-time status tracking and comprehensive error handling.