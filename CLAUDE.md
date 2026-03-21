# Adore — Your Style Intelligence

## What This Is
AI-powered personal stylist and wardrobe intelligence platform. Combines persistent AI memory, a personalized Happiness Function, and behavioral taste analysis to help users dress better, spend smarter, and build wardrobes they love.

## Architecture
- **Mobile:** React Native (Expo) — iOS first, Android Phase 2
- **Backend:** Hono (TypeScript) on Fly.io
- **Database:** PostgreSQL + pgvector via Supabase (Auth, Storage, RLS)
- **AI:** Claude API (vision + text), Marqo-FashionSigLIP (embeddings), rembg (background removal)
- **Cache:** Upstash Redis
- **Images:** Cloudflare R2 or Supabase Storage
- **Jobs:** Inngest (event-driven background processing)

## Project Structure
```
adore/
├── apps/
│   ├── mobile/          # Expo/React Native app
│   └── api/             # Hono backend API
├── packages/
│   └── shared/          # Shared types, constants, utils
├── docs/
│   └── OVERVIEW.md      # Detailed product specification
├── supabase/
│   └── migrations/      # Database migrations
└── scripts/             # Dev scripts, seed data
```

## Key Concepts
- **Happiness Function:** Personalized reward model `H(item, user, context) → [0-10]` predicting satisfaction from clothing items/purchases
- **Taste Graph:** Multi-dimensional style profile derived from behavioral data (what you wear, not what you say you like)
- **PreferenceSignal:** Append-only event stream of all user actions (wore, rated, purchased, returned, skipped, etc.)
- **Outfit Journal:** Daily "what I wore" snap that passively builds wardrobe + feeds all analytics

## Conventions
- TypeScript everywhere (strict mode)
- All database queries are user-scoped (RLS enforced)
- PreferenceSignal is append-only — never update, only insert
- AgentMemory uses supersession chains — never delete, use `superseded_by`
- Embeddings carry `model_version` for safe model upgrades
- Derived fields (cost_per_wear, happiness_score, etc.) are denormalized and updated via background jobs

## Commands
```bash
# Development
pnpm dev              # Start all services
pnpm dev:mobile       # Start Expo dev server
pnpm dev:api          # Start API server

# Database
pnpm db:migrate       # Run Supabase migrations
pnpm db:reset         # Reset and re-seed database
pnpm db:types         # Generate TypeScript types from schema

# Testing
pnpm test             # Run all tests
pnpm test:api         # Backend tests only
pnpm test:mobile      # Mobile tests only

# Build
pnpm build            # Build all packages
pnpm build:api        # Build API for deployment
```
