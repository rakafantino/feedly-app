---
name: implementing-tdd-workflow
description: Enforces Test-Driven Development (TDD) for Next.js and Neon DB. Use when starting new features, creating API endpoints, or modifying existing business logic to ensure unit test coverage and type safety.
---

# TDD Workflow for Next.js & Neon

## Goal

Ensure all features are developed starting with tests, maintaining 100% type safety and linter compliance, specifically for Next.js fullstack routes and Neon database interactions.

## Core Instructions

### 1. The Red-Green-Refactor Loop

Before writing any functional code, follow this strict sequence:

1. **Red**: Write a failing unit test in `__tests__` or alongside the file (e.g., `*.test.ts`).
2. **Green**: Write the minimal code necessary to pass the test.
3. **Refactor**: Clean up the code while ensuring tests stay green.

### 2. Testing Priority

Always address **Edge Cases** before **Happy Paths**:

- Unauthorized/Unauthenticated access.
- Invalid input payloads (Zod validation).
- Database connection failures (Neon-specific).
- Empty states or null returns.
- Finally, the successful standard operation.

### 3. Technical Constraints

- **TypeScript**: No `any` types. Ensure all Neon schema types are correctly imported.
- **Linting**: Run `npm run lint` or `next lint` after every Refactor step.
- **Endpoints**: Every new API route in `app/api/` must have a corresponding test file.

## Quality Workflow

Copy and track this progress for every new feature:
