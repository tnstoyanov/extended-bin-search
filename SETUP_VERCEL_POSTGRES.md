# Vercel Postgres (Neon) Setup Guide

The application now supports both **SQLite** (local development) and **Vercel Postgres** (production).

## Current Status

- ✅ **App deployed** to Vercel at https://binbase-search.vercel.app
- ✅ **Running on SQLite** locally (fallback for development)  
- ⏳ **Need to connect** Vercel Postgres for production database

## Setup Vercel Postgres (Neon)

### Step 1: Add Vercel Postgres Integration

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click **Settings** → **Integrations**
3. Search for **Vercel Postgres** (or **Storage** → **Postgres**)
4. Click **Add** and follow the prompts to create a new Postgres database
5. Accept the terms and create the database

### Step 2: Verify Connection String

After creating the database:

1. The connection string will be automatically set in your Environment Variables
2. The environment variable should be named `POSTGRES_PRISMA_URL` or `POSTGRES_URL`
3. You should see it in **Settings** → **Environment Variables**

Alternatively, in the Neon dashboard:
1. Go to https://console.neon.tech
2. Find your project and database
3. Copy the connection string

### Step 3: Import Data Locally

From your local machine:

```bash
# Make sure you have the SQLite database locally
npm run init-db    # Creates/populates bins.db

# Set your Vercel Postgres connection string
export POSTGRES_PRISMA_URL="your-connection-string-here"

# Or add it to .env.local
echo "POSTGRES_PRISMA_URL=your-connection-string-here" >> .env.local

# Run the import
npm run import-postgres
```

This will:
- Create the bins table in Postgres
- Import all 3.3M BIN records from local SQLite
- Create indexes for fast searching

### Step 4: Verify Production Database

```bash
# Test the production endpoint
curl https://binbase-search.vercel.app/api/health

# Expected response:
# {"status":"ok","database":"postgres","recordCount":3291459}
```

## Quick Start from Vercel Dashboard

1. **Go to Vercel Project Settings**: https://vercel.com/tony-stoyanovs-projects/binbase-search/settings
2. **Storage** section (left sidebar) → **Create Database** → **Postgres**
3. **Create New** → Follow setup wizard
4. **Environment Variables** will be auto-populated
5. **Redeploy** the application

## Testing the Application

### Local Testing (SQLite)
```bash
npm start
curl http://localhost:3000/api/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"bin": "556363"}'
```

### Production Testing (Postgres)
```bash
curl https://binbase-search.vercel.app/api/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"bin": "556363"}'
```

## Troubleshooting

### Connection String Not Found
- Check Vercel Project Settings → Environment Variables
- Ensure `POSTGRES_PRISMA_URL` or `POSTGRES_URL` is set
- Restart your Vercel deployment after setting variables

### Import Fails
- Verify SQLite database exists: `ls -lh data/bins.db`
- Check connection string is valid
- Monitor import progress in terminal
- Large import (3.3M records) may take 10-15 minutes

### Slow Queries
- Indexes are created automatically during import
- If missing, manually run: `CREATE INDEX idx_bins_prefix ON bins (bin)`

## Database Schema

```sql
CREATE TABLE bins (
  id SERIAL PRIMARY KEY,
  bin VARCHAR(11),              -- Bank Identification Number
  card_brand VARCHAR(255),      -- VISA, MASTERCARD, etc.
  issuer VARCHAR(255),          -- Bank name
  card_type VARCHAR(255),       -- CREDIT, DEBIT, etc.
  card_level VARCHAR(255),      -- STANDARD, GOLD, PLATINUM, etc.
  country_name VARCHAR(255),    -- Issue country
  country_code_a2 VARCHAR(2),   -- ISO 3166-1 alpha-2 code
  country_code_a3 VARCHAR(3),   -- ISO 3166-1 alpha-3 code
  country_code_numeric VARCHAR(3),  -- ISO 3166-1 numeric code
  bank_website VARCHAR(255),    -- Bank website
  bank_phone VARCHAR(255),      -- Bank phone
  pan_length VARCHAR(255),      -- PAN length
  personal_commercial VARCHAR(255), -- Account type
  regulated VARCHAR(255)        -- Regulatory status
);

CREATE INDEX idx_bins_prefix ON bins (bin);  -- For prefix search
```

## Architecture

The application uses:
- **Local Dev**: SQLite (`data/bins.db`) - Fast, no setup required
- **Production**: Vercel Postgres/Neon - Scalable, managed service

The server automatically detects which database to use based on environment variables:
- If `POSTGRES_PRISMA_URL` is set → Uses Postgres
- Otherwise → Falls back to SQLite
