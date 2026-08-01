# Coding Standards

## Overview
This document outlines the coding standards and best practices for the Improv Today project.

## General Principles

### Code Quality
- Write clean, readable, and maintainable code
- Follow DRY (Don't Repeat Yourself) principles
- Use meaningful variable and function names
- Keep functions small and focused on a single responsibility
- Write comprehensive tests for all business logic

### Code Organization
- Follow established project structure patterns
- Group related functionality together
- Use consistent file and folder naming conventions
- Maintain clear separation of concerns

## Frontend Standards (Next.js/React/TypeScript)

### File Structure
- Use kebab-case for file and folder names
- Components should be in PascalCase
- Use `.tsx` extension for React components
- Use `.ts` extension for utility functions and types

### React/Next.js Best Practices
- Use functional components with hooks
- Implement proper error boundaries
- Use TypeScript for all code
- Follow Next.js App Router conventions
- Use server components where appropriate
- Implement proper loading and error states

### Styling
- Use Tailwind CSS for styling
- Follow Tailwind's utility-first approach
- Use CSS custom properties for consistent theming
- Ensure responsive design across all breakpoints

### State Management
- Use Zustand for global state management
- Keep state as close to where it's used as possible
- Use React Query/SWR for server state management
- Implement proper loading and error states

## Backend Standards (FastAPI/Python)

### Python Code Style
- Follow PEP 8 style guidelines
- Use type hints for all functions and variables
- Use meaningful docstrings for all functions and classes
- Keep line length under 88 characters (Black formatter standard)

### API Design
- Follow RESTful API conventions
- Use proper HTTP status codes
- Implement comprehensive error handling
- Use Pydantic models for request/response validation
- Document all endpoints with OpenAPI/Swagger

### Database
- Use SQLAlchemy 2.0+ async patterns
- Implement proper database migrations with Alembic
- Use database transactions appropriately
- Follow proper indexing strategies

### Security
- Implement proper authentication and authorization
- Use environment variables for sensitive configuration
- Validate all input data
- Follow OWASP security guidelines

## Testing Standards

### Frontend Testing
- Write unit tests for utility functions
- Write integration tests for components
- Use Jest and Testing Library
- Aim for >80% code coverage

### Backend Testing
- Write unit tests for all business logic
- Write integration tests for API endpoints
- Use pytest and pytest-asyncio
- Mock external dependencies
- Aim for >90% code coverage

## Git Workflow

### Commit Messages
- Use conventional commit format
- Write clear, descriptive commit messages
- Keep commits atomic and focused

### Branch Strategy
- Use feature branches for development
- Follow semantic versioning for releases
- Use descriptive branch names

## Code Review Process

### Requirements
- All code must be reviewed before merging
- Ensure tests pass before review
- Check for security vulnerabilities
- Verify coding standards compliance

### Review Checklist
- [ ] Code follows project standards
- [ ] Tests are comprehensive and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed