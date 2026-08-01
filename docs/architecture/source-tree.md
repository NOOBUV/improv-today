# Source Tree Structure

## Overview
This document describes the organizational structure of the Improv Today project repository.

## Root Directory Structure

```
improv-today/
├── .bmad-core/              # BMAD™ Core framework configuration and tasks
├── .claude/                 # Claude Code IDE configuration and commands
├── .cursor/                 # Cursor IDE configuration rules
├── .superdesign/           # SuperDesign tool configuration
├── content/                # Static content and assets
├── docs/                   # Project documentation
├── improv-today-backend/   # Python FastAPI backend application
├── improv-today-frontend/  # Next.js React frontend application
└── web-bundles/           # Modular web development bundles
```

## Documentation Structure (`docs/`)

```
docs/
├── architecture/           # Technical architecture documentation
│   ├── coding-standards.md
│   ├── tech-stack.md
│   ├── source-tree.md
│   └── 4-data-models.md
├── prd/                   # Product Requirements Documents (sharded)
├── stories/               # Development stories and tasks
├── architecture.md        # Main architecture document
└── prd.md                 # Main PRD document
```

## Backend Structure (`improv-today-backend/`)

```
improv-today-backend/
├── .github/               # GitHub workflows and CI/CD
│   └── workflows/
├── alembic/              # Database migration management
│   └── versions/         # Migration version files
├── app/                  # Main application code
│   ├── api/             # API endpoints and routes
│   ├── auth/            # Authentication and authorization
│   ├── core/            # Core configuration and utilities
│   ├── models/          # SQLAlchemy database models
│   ├── schemas/         # Pydantic schemas for data validation
│   └── services/        # Business logic and service layer
├── content/             # Content management and data
│   └── clara/          # Character-specific content
│       └── development/
├── static/              # Static assets served by the backend
├── tests/               # Test suite
├── requirements.txt     # Python dependencies
├── .env                # Environment configuration
└── main.py             # Application entry point
```

### Key Backend Files
- `main.py` - FastAPI application entry point
- `requirements.txt` - Python package dependencies
- `.env` - Environment variables (not committed)
- `alembic.ini` - Database migration configuration

## Frontend Structure (`improv-today-frontend/`)

```
improv-today-frontend/
├── .claude/             # Claude-specific configuration
├── public/              # Static public assets
├── src/                 # Source code
│   ├── app/            # Next.js App Router pages and API routes
│   │   ├── api/        # API route handlers
│   │   │   └── backend/[...path]/ # Backend proxy routes
│   │   ├── auth/       # Authentication pages
│   │   │   ├── callback/
│   │   │   └── token/
│   │   ├── practice/   # Practice session pages
│   │   └── test-auth/  # Authentication testing
│   ├── components/     # React components
│   │   ├── suggestions/
│   │   └── ui/         # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility libraries and configurations
│   ├── services/       # API service functions
│   ├── store/          # Zustand state management
│   └── utils/          # Utility functions
├── package.json        # Node.js dependencies and scripts
├── tailwind.config.js  # Tailwind CSS configuration
├── tsconfig.json       # TypeScript configuration
└── next.config.js      # Next.js configuration
```

### Key Frontend Files
- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS setup
- `next.config.js` - Next.js configuration
- `.env.local` - Local environment variables (not committed)

## Configuration Directories

### BMAD Core (`.bmad-core/`)
- `agents/` - AI agent definitions
- `agent-teams/` - Team configurations
- `tasks/` - Reusable task definitions
- `templates/` - Document templates
- `workflows/` - Process workflows
- `checklists/` - Quality assurance checklists
- `utils/` - Utility functions and helpers
- `data/` - Static data files
- `core-config.yaml` - Main configuration file

### Claude Code (`.claude/`)
- `agents/` - Claude-specific agent definitions
- `commands/BMad/` - BMAD command definitions
  - `agents/` - Agent configurations
  - `tasks/` - Task definitions
- `settings.local.json` - Local IDE settings

### Development Tools
- `.cursor/rules/` - Cursor IDE specific rules and configurations
- `.superdesign/` - SuperDesign tool configuration and iterations
- `web-bundles/` - Modular development bundles and expansion packs

## File Naming Conventions

### Frontend
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Pages**: kebab-case (e.g., `practice-session/page.tsx`)
- **Utilities**: kebab-case (e.g., `api-client.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`)

### Backend
- **Python modules**: snake_case (e.g., `user_service.py`)
- **Classes**: PascalCase (e.g., `UserService`)
- **Functions**: snake_case (e.g., `get_user_profile`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DATABASE_URL`)

### Documentation
- **All docs**: kebab-case with `.md` extension
- **Architecture docs**: descriptive names (e.g., `coding-standards.md`)
- **Stories**: numbered with descriptive suffix (e.g., `1.1.backstory-generation.md`)

## Development Workflow Directories

### Testing
- **Backend**: `improv-today-backend/tests/`
- **Frontend**: Test files co-located with components using `.test.tsx` suffix

### Build Outputs
- **Frontend**: `.next/` (excluded from version control)
- **Backend**: `__pycache__/`, `.pytest_cache/` (excluded from version control)

### Dependencies
- **Frontend**: `node_modules/` (excluded from version control)
- **Backend**: Virtual environment directories (excluded from version control)

## Key Integration Points

### API Communication
- Frontend proxy routes: `src/app/api/backend/[...path]/`
- Backend API endpoints: `app/api/`

### Authentication
- Frontend auth handling: `src/app/auth/`
- Backend auth services: `app/auth/`

### State Management
- Frontend global state: `src/store/`
- Backend database models: `app/models/`

### Configuration
- Environment variables managed separately for frontend (`.env.local`) and backend (`.env`)
- Shared configuration through documentation in `docs/`