# 🧠 COA Scraper — Cannabis Certificate of Analysis Data Extraction

  
**Tech Stack:** Next.js 15 • React 19 • TypeScript 5 • Prisma 6 • Tailwind 4 • Mistral AI OCR  

---

## 🌿 Project Overview
**COA Scraper** is a Next.js application designed to automate the extraction of key information from cannabis Certificates of Analysis (COAs) in PDF format.  
It leverages **AI-powered OCR** and a **multi-strategy extraction engine** to accurately identify and validate cannabinoid data, terpene profiles, strain names, and batch identifiers across diverse laboratory templates.

The system provides real-time processing feedback, confidence scoring, and export capabilities for structured reporting — eliminating the need for manual data entry and reducing processing time dramatically.

---

## ⚙️ Key Features
- **AI-Powered OCR** using Mistral AI v1.10 for high-accuracy text recognition.  
- **Multi-Strategy Extraction Engine** with lab-specific algorithms (2River Labs, SC Labs, Steep Hill).  
- **Advanced Text Processing** — normalization, pattern recognition, and data validation with confidence scoring.  
- **Real-Time Status Tracking** via asynchronous queues and polling.  
- **Copy-to-Clipboard & CSV Export** for single or multiple documents.  
- **Responsive UI** built with React 19 + Tailwind 4.  
- **Cloud Deployment** on Vercel with PostgreSQL and Blob Storage integration.  
- **Comprehensive Error Handling** and fallback OCR providers for maximum reliability.

---

## 🧩 Architecture Overview
- **Frontend:** Next.js 15 (App Router) + React 19 for modular UI components.  
- **Backend:** Next.js API Routes + Prisma ORM with PostgreSQL support.  
- **AI Layer:** Mistral OCR service integrated with a custom multi-strategy extraction pipeline.  
- **Data Validation:** Range and contextual checks with aggregated confidence scores.  
- **Storage:** Cloud database (PostgreSQL) and file storage (Vercel Blob).  
- **Monitoring:** Health checks, error logging, and processing statistics endpoints.

---

## 🧠 Development Highlights
- Implemented **asynchronous processing queues** for large-scale PDF handling.  
- Engineered **lab-specific extraction strategies** improving accuracy across different COA formats.  
- Designed **type-safe architecture** throughout the stack using TypeScript 5.  
- Built **custom React components** for upload, processing, and visualization of results.  
- Integrated **AI-enhanced validation** combining rule-based and semantic analysis.  
- Achieved **95 % + data extraction accuracy** on sample datasets.  

---

## 📊 Data Extraction Capabilities
**Extracted Data Points**
- Batch Identifiers (EVM codes, unique product IDs)  
- Strain Names and Product Categories  
- Cannabinoid Profiles (THC %, CBD %, Total Cannabinoids)  
- Terpene Profiles and Percentages  
- Laboratory Information and Test Dates  
- Confidence Scores and Validation Logs  

---

## 🚀 Project Status
The current version delivers a fully functional, production-ready COA extraction system.  

---

© 2025 Ruben Hernandez Alvarado — Frontend Developer  
This repository is for portfolio and demonstration purposes.
