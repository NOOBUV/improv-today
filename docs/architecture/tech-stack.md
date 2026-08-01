# Technology Stack

## Overview
This document outlines the complete technology stack used in the Improv Today project.

## Frontend Stack

### Core Framework
- **Next.js 15.4.4** - React-based full-stack framework with App Router
- **React 19.1.0** - Frontend library for building user interfaces
- **TypeScript 5.x** - Static type checking for JavaScript

### UI/UX Libraries
- **Tailwind CSS 4.x** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible UI components
  - Avatar, Popover, Progress, Slot, Tabs
- **Lucide React** - Icon library
- **Framer Motion** - Animation library for React
- **class-variance-authority (CVA)** - Creating variant-based component APIs
- **clsx & tailwind-merge** - Conditional className utilities

### State Management
- **Zustand** - Lightweight state management library
- **Immer** - Immutable state updates

### Data Visualization
- **Recharts** - Chart library built on React components

### Development Tools
- **ESLint 9.x** - Code linting and formatting
- **Next.js ESLint Config** - Next.js-specific ESLint rules

## Backend Stack

### Core Framework
- **FastAPI 0.115.6** - Modern, fast web framework for Python
- **Python 3.11+** - Programming language
- **Uvicorn 0.34.0** - ASGI server implementation
- **Gunicorn 22.0.0** - Python WSGI HTTP Server

### Database & ORM
- **PostgreSQL** - Primary production database
- **SQLite** - Development database
- **SQLAlchemy 2.0.36** - SQL toolkit and ORM with async support
- **Alembic 1.14.0** - Database migration tool
- **psycopg 3.2.3** - PostgreSQL adapter for Python
- **aiosqlite 0.20.0** - Async SQLite support

### Data Validation & Settings
- **Pydantic 2.10.5** - Data validation using Python type hints
- **Pydantic Settings 2.8.0** - Settings management
- **python-dotenv 1.0.1** - Load environment variables from .env files

### Authentication & Security
- **Auth0** - Authentication and authorization service
- **PyJWT 2.9.0** - JSON Web Token implementation
- **Passlib 1.7.4** - Password hashing utilities

### AI/ML Integration
- **OpenAI API 1.99.9** - Integration with OpenAI models
- **textstat 0.7.4** - Text analysis and readability metrics

### HTTP & Networking
- **httpx 0.28.1** - Async HTTP client
- **requests** - HTTP library for Python
- **python-multipart 0.0.18** - Multipart form data parsing

### Caching & Session Management
- **Redis 5.2.1** - In-memory data structure store for caching and session management

### Development & Testing
- **pytest** - Testing framework
- **pytest-asyncio** - Pytest support for asyncio

## Infrastructure & Deployment

### Version Control
- **Git** - Distributed version control system
- **GitHub** - Git repository hosting and CI/CD

### Environment Management
- **Python Virtual Environments** - Isolated Python environments
- **Node.js/npm** - JavaScript runtime and package management

## Architecture Patterns

### Frontend Architecture
- **Component-Based Architecture** - Modular, reusable React components
- **Server-Side Rendering (SSR)** - Next.js App Router with server components
- **Static Site Generation (SSG)** - Pre-rendered pages where appropriate
- **Client-Side Rendering (CSR)** - Dynamic content with React

### Backend Architecture
- **RESTful API Design** - HTTP-based API following REST principles
- **Async/Await Pattern** - Non-blocking I/O operations
- **Dependency Injection** - FastAPI's built-in DI system
- **Repository Pattern** - Data access layer abstraction
- **Service Layer Pattern** - Business logic separation

### Database Architecture
- **Relational Database Design** - PostgreSQL with proper normalization
- **Migration-Based Schema Management** - Alembic for database versioning
- **Connection Pooling** - Efficient database connection management

### Security Architecture
- **JWT-Based Authentication** - Stateless authentication tokens
- **Role-Based Access Control (RBAC)** - Permission-based access management
- **CORS Configuration** - Cross-origin resource sharing setup
- **Environment-Based Configuration** - Secure secrets management

## Development Workflow

### Code Quality Tools
- **ESLint** - Frontend code linting
- **Prettier** - Code formatting (via ESLint config)
- **TypeScript Compiler** - Static type checking
- **Black** - Python code formatting (recommended)
- **pytest** - Backend testing framework

### Package Management
- **npm** - Frontend package management
- **pip** - Python package management
- **requirements.txt** - Python dependency specification