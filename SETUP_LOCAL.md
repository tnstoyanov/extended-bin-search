# Local Development Setup Guide

This guide helps you set up PostgreSQL locally for development.

## Option 1: Using Homebrew (macOS)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database
createdb bindb

# Connect to verify
psql bindb
\q
```

## Option 2: Using Docker

```bash
# Run PostgreSQL in Docker
docker run --name postgres-bin \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=bindb \
  -p 5432:5432 \
  -d postgres:15

# Verify connection
psql postgresql://postgres:dev@localhost:5432/bindb
```

## Setup Environment File

Create `.env.local`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/bindb
NODE_ENV=development
PORT=3000
```

Replace `password` with your actual PostgreSQL password.

## Import BIN Data

```bash
# Make sure bins_all.csv exists in data/ folder
npm run init-db
```

This will:
1. Create the `bins` table
2. Import 3.3M+ BIN records from CSV
3. Create indexes for fast searching

## Start Development Server

```bash
npm start
```

Visit `http://localhost:3000` in your browser.

## Test the API

```bash
# Search for BIN starting with 556363
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"bin": "556363"}'
```

## Reset Database

To clear and reimport data:

```bash
npm run init-db
```

## Check Database Size

```bash
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('bindb'));"
```

## Troubleshooting

### Can't connect to PostgreSQL

1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres
   ```

2. Check DATABASE_URL format is correct

3. Reset password:
   ```bash
   psql -U postgres -c "ALTER USER postgres PASSWORD 'newpassword';"
   ```

### Out of memory during import

Increase system memory or import in batches. The script uses 10,000-record batches by default.

### Slow imports

Normal for 3.3M records: should take 2-5 minutes depending on hardware.
