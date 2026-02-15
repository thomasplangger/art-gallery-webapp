# Art Gallery Web Platform with AI-Assisted Publishing

Full-stack art gallery application built for real-world artwork management, presentation, and automated social media publishing.

The platform combines a curated React frontend, a production-ready PHP/MySQL layer, and an extended FastAPI service layer for AI-powered workflows.

---

## Overview

This project was developed as a deployable gallery management system to streamline:

- Artwork publishing and catalog management
- Secure admin editing workflows
- Media uploads and site content updates
- AI-assisted content generation for social media

The architecture supports stable production CRUD operations while enabling advanced AI features through a modular backend design.

Page:
https://jpart.at/

---

## Core Engineering Components

### 1) Artwork Catalog & Admin Management

- Structured artwork records (title, year, medium, dimensions, price, status)
- Category management and filtering
- Admin-only create/update/delete workflows
- Availability handling (`available`, `reserved`, `sold`)
- Search, sorting, and multi-filter browsing in the frontend

The system separates public catalog viewing from protected mutation paths.

---

### 2) Hybrid Backend Architecture (PHP + FastAPI)

The platform supports two backend modes:

- **PHP + MySQL layer**
  - Stable CRUD operations
  - Image uploads
  - Site content settings

- **FastAPI service layer**
  - Authentication and session handling
  - AI caption generation
  - AI scene staging
  - Instagram publishing workflow

The frontend can dynamically switch API bases, allowing incremental migration and flexible deployment.

This demonstrates:
- Backend interoperability
- Progressive system evolution
- Deployment-aware architecture design

---

### 3) Media Upload & Content Management

- Secure image upload with MIME/type/size validation
- Controlled public URL generation
- Editable site-level content (About / Imprint)
- CORS restrictions for production domains

This allows non-technical users to update content without redeploying the application.

---

### 4) AI-Assisted Social Media Automation

The FastAPI backend enables creative automation workflows:

- AI-generated Instagram captions (style and language configurable)
- AI scene staging for artwork presentation previews
- Webhook/queue-based Instagram publishing integration
- Optional hashtag rotation logic

The goal is to reduce friction between artwork creation and online promotion while retaining editorial control.

---

## System Architecture

User Interaction (public gallery + admin dashboard)  
→ React Frontend  
→ API Layer Selection (PHP CRUD and/or FastAPI services)  
→ MySQL + File Storage (artwork data + uploads)  
→ FastAPI AI Services (captioning, scene generation, social workflows)  
→ Public Website + Social Media Distribution  

The frontend is designed to operate against either backend path, supporting flexible deployment models.

---

## Core Features

- Public artwork catalog with filtering and search
- Admin-protected content management
- Image upload with server-side validation
- AI-generated captions for social posts
- AI-assisted presentation scene generation
- Integrated Instagram publishing workflow
- Production-oriented hybrid backend architecture

---

## Tech Stack

### Backend
- Python (FastAPI + Uvicorn)
- PHP 8 + PDO (MySQL)
- OpenAI SDK / Google GenAI SDK
- PyJWT + Passlib (auth)
- HTTPX / Pillow

### Frontend
- React 18
- TailwindCSS
- shadcn/ui + Radix UI
- React Router

### Data Layer
- MySQL (catalog persistence)
- File-based upload storage

---

## Repository Structure

```
.
├── backend/        # FastAPI services (AI, auth, social workflows)
├── frontend/       # React gallery + admin application
└── README.md
```

---

## Local Development

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm start
```

---

## Engineering Focus

This project demonstrates:

- Real-world full-stack deployment
- Hybrid backend interoperability
- AI feature integration into production workflows
- Authentication and session handling
- Media management pipelines
- System design for gradual migration and extensibility
