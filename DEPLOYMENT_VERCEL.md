# Vercel Deployment Guide

Complete step-by-step guide to deploy this BIN Search app to Vercel with Vercel Postgres.

## Prerequisites

- GitHub account with the repository pushed
- Vercel account (free tier works)
- The `bins_all.csv` file available locally

## Step 1: Set Up Vercel Postgres Database

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Go to **Storage** tab → **Create** → **Postgres**
3. Select region (choose closest to your users)
4. Name: `bindb` (or your preference)
5. Click **Create**
6. Copy the connection string from **Quickstart** tab

The connection string looks like:
```
postgresql://[user]:[password]@[host]/[database]
```

## Step 2: Deploy App to Vercel

### Option A: Using GitHub Integration (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select **Continue with GitHub**
3. Find and select `extended-bin-search` repository
4. Click **Import**
5. Configure project:
   - Framework: **Other** (or leave as detected)
   - Root Directory: `.` (default)
   - Build Command: leave blank
   - Install Command: `npm install`
6. Click **Deploy**

Wait for deployment to complete (~2 minutes)

### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd extended-bin-search
vercel --prod
```

## Step 3: Add Environment Variables

After deployment completes:

1. Go to your Vercel project
2. Click **Settings** → **Environment Variables**
3. Add new variable:
   - Name: `DATABASE_URL`
   - Value: [Your Postgres connection string from Step 1]
   - Environments: **Production**
4. Click **Save**
5. Go to **Deployments** and redeploy the latest commit

## Step 4: Initialize Database

The database exists but is empty. Initialize it with BIN data:

### Option A: Using Vercel CLI

```bash
# Pull environment variables locally
vercel env pull

# Run initialization
npm run init-db
```

### Option B: Using Connection String Directly

```bash
# Replace with your actual Vercel Postgres URL
export DATABASE_URL="postgresql://[user]:[password]@[host]/[database]"
npm run init-db
```

The import will take 5-15 minutes depending on server performance.

### Monitor Progress

You'll see output like:
```
Starting database import from CSV...
Created bins table with indexes
Read 100000 lines, inserted 99999...
Read 200000 lines, inserted 199999...
...
Inserted 3291459 records
Database initialization complete!
```

## Step 5: Test Live Deployment

Once initialization completes:

1. Visit your Vercel deployment URL
2. Enter a BIN: `556363`
3. Click Search
4. Verify results appear

Or test API:
```bash
curl -X POST https://your-app.vercel.app/api/search \
  -H "Content-Type: application/json" \
  -d '{"bin": "556363"}'
```

## Step 6: Set Up Custom Domain (Optional)

1. Go to Vercel project **Settings** → **Domains**
2. Add your domain
3. Follow DNS setup instructions
4. Wait for domain to propagate (5-60 minutes)

## Updating Data

To reimport BINs after updating `bins_all.csv`:

```bash
# Set your DATABASE_URL
export DATABASE_URL="your-vercel-postgres-url"

# Rerun import (drops and recreates table)
npm run init-db
```

## Monitoring

### Check Database Size

```bash
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('bindb'));"
```

### View Recent Queries

In Vercel Dashboard → **Storage** → Your Postgres database → **Monitoring** tab

### Check Function Logs

In Vercel Dashboard → **Functions** → View logs for API errors

## Troubleshooting

### "DATABASE_URL is undefined"

Make sure you added the environment variable and redeployed:
1. Settings → Environment Variables → Check DATABASE_URL exists
2. Deployments → Click latest deployment → Redeploy

### "connection timeout" during init-db

Your CSV file is large (326MB). May take several attempts:
```bash
# Retry initialization
npm run init-db
```

If it keeps failing:
- Try from a machine with better internet
- Contact Vercel support if persistent

### "Function timed out"

The import script runs locally and creates a persistent database, not a Vercel Function, so timeouts shouldn't occur. If you see errors:
1. Check DATABASE_URL is correct
2. Verify PostgreSQL instance is accepting connections
3. Try running from a different network

### Searches returning no results

Verify data was imported:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bins;"
```

Should return ~3.3M records. If 0, rerun `npm run init-db`

## Performance Tips

1. **Use Vercel Postgres:** It's in the same region as your functions = fast
2. **Index queries:** The app automatically uses the `idx_bins_prefix` index
3. **Connection pooling:** Already configured in `server.js`
4. **Regional deployment:** Choose database region closest to your users

## Costs

- **Vercel:** Free tier includes generous serverless function usage
- **Postgres:** Free tier includes 7 days of storage + $1/month per 1GB thereafter
- **This app:** ~341MB database ≈ $1/month on Vercel Postgres

## Next Steps

- Monitor performance in Vercel Dashboard
- Set up alerting for errors
- Consider adding analytics
- Plan for data updates

## Support

For Vercel-specific issues: [Vercel Docs](https://vercel.com/docs)
For Postgres issues: [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)
