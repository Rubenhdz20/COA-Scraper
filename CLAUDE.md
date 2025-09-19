# COA Scraper - Cannabis Certificate of Analysis Data Extraction

A Next.js application for automated extraction of cannabis Certificate of Analysis (COA) data from PDF lab results using AI-powered OCR technology.

## Project Overview

**Name:** COA Scraper
**Version:** 0.1.0
**Status:** Beta - Under Development
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
- **Multer 2.0.2** for file upload handling

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
│   │   ├── layout.tsx         # Root layout with header/footer
│   │   ├── page.tsx           # Homepage with upload interface
│   │   ├── globals.css        # Global Tailwind styles
│   │   └── api/               # API routes
│   │       └── test-db/       # Database connection testing
│   ├── components/            # Reusable React components
│   │   └── ui/               # UI component library
│   │       ├── Button.tsx    # Button component
│   │       └── Card.tsx      # Card component
│   ├── lib/                  # Utility libraries
│   │   └── prisma.ts         # Prisma client configuration
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Utility functions
│   └── generated/            # Generated code (Prisma client)
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

### Current Implementation
- ✅ Project setup with Next.js 15 and TypeScript
- ✅ Database schema for COA data storage
- ✅ Responsive UI with Tailwind CSS
- ✅ Database connection testing API
- ✅ Basic project structure and components

### Planned Features (Phase 2)
- 🚧 PDF file upload with drag-and-drop interface
- 🚧 AI-powered OCR for text extraction
- 🚧 Data parsing and cannabis-specific field extraction
- 🚧 Confidence scoring for extracted data
- 🚧 Data validation and error handling
- 🚧 Export functionality (CSV, JSON, Excel)
- 🚧 Processing history and batch management
- 🚧 Search and filtering capabilities

## Data Extraction Capabilities

The system is designed to extract the following data points from COA PDFs:
- **Batch Identifiers** - Unique product tracking numbers
- **Strain Names** - Cannabis variety/product names
- **Cannabinoid Profiles** - THC%, CBD%, and other cannabinoid percentages
- **Terpene Profiles** - Flavor and aroma compound data
- **Lab Information** - Testing facility details and test dates
- **Compliance Data** - Regulatory compliance information

## API Endpoints

### Database Testing
- `GET /api/test-db` - Test database connectivity
- `GET /api/test-db/health` - Database health check

## Configuration

### Environment Variables
- `DATABASE_URL` - Prisma database connection string (SQLite)
- `NODE_ENV` - Environment setting (development/production)

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

## Notes for Claude Code

- Always run `npm run lint` after making code changes
- Use `npx prisma generate` after schema modifications
- The project uses Turbopack for faster builds in development
- File uploads will be implemented in Phase 2 with multer
- OCR functionality will integrate with external AI services
- Database is currently SQLite for development; production may use PostgreSQL

## Project Status

This is a **beta project under active development**. The core infrastructure is complete, but file upload and OCR processing features are planned for Phase 2 implementation.