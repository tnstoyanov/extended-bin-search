# Vercel Deployment Guide

Complete step-by-step guide to deploy this BIN Search app to Vercel with Neon PostgreSQL.

## Prerequisites

- GitHub account with the repository pushed
- Vercel account (free tier works)
- Neon account (free tier available at [neon.tech](https://neon.tech))
- The `bins_all.csv` file available locally

## Step 1: Set Up Neon PostgreSQL Database

1. Go to [neon.tech](https://neon.tech) and sign up (free tier available)
2. Click **Create Project** or **+ New Project**
3. Configure project:
   - **Name:** `bindb` (or your preference)
   - **Database name:** `bindb`
   - **Region:** Choose closest to you
   - **PostgreSQL version:** 15 (or latest)
4. Click **Create Project**
5. You'll be on the **Dashboard**. Copy your connection string:
   - Click **Connection** dropdown → **Connection string**
   - Copy the `postgresql://` URL

The connection string looks like:
```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

**Save this URL** - you'll need it next

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
   - Value: [Your Neon PostgreSQL connection string from Step 1]
   - Environments: **Production**
4. Click **Save**
5. Go to **Deployments** and redeploy the latest commit to apply the env var

## Step 4: Initialize Database

The database exists but is empty. Initialize it with BIN data:

### Option A: Using Vercel CLI

```bash
# Pull environment variables locally
vercel env pull --yes

# Run initialization
npm run init-db
```

### Option B: Using Connection String Directly

```bash
# Replace with your actual Neon PostgreSQL URL
export DATABASE_URL="postgresql://[user]:[password]@[host]/[database]?sslmode=require"
npm run init-db
```

The import will take 5-15 minutes depending on connection speed.

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
# Set your DATABASE_URL from Neon
export DATABASE_URL="postgresql://[user]:[password]@[host]/[database]?sslmode=require"

# Rerun import (drops and recreates table)
npm run init-db
```

## Monitoring

### Check Database Size

```bash
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('bindb'));"
```

### View Database Dashboard

1. Go to [neon.tech](https://neon.tech)
2. Select your project
3. Click **Monitoring** to see usage stats, connection count, and query logs
4. Click **Browse Branches** to see database contents via web dashboard

### Check App Logs

In Vercel Dashboard → **Functions** → View logs for any API errors

## Troubleshooting

### "DATABASE_URL is undefined"

Make sure you added the environment variable and redeployed:
1. Settings → Environment Variables → Check DATABASE_URL exists
2. Deployments → Click latest deployment → Click **Redeploy**

### "connection timeout" or "SSL error" during init-db

The CSV import is large (326MB). Solutions:
```bash
# Retry initialization
npm run init-db

# If persistently failing, check your Neon connection:
psql $DATABASE_URL -c "SELECT 1;"
```

If you see SSL errors, ensure your connection string includes `?sslmode=require`

### Searches returning no results

Verify data was imported:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bins;"
```

Should return ~3.3M records. If 0, rerun `npm run init-db`

### "relation "bins" does not exist"

The table wasn't created. Rerun initialization:
```bash
npm run init-db
```

## Performance Tips

1. **Use Neon:** It's a managed PostgreSQL service optimized for serverless
2. **Index queries:** The app automatically uses the `idx_bins_prefix` index
3. **Connection pooling:** Already configured in `server.js`
4. **SSL/TLS:** Always used for secure connections

## Costs

- **Vercel:** Free tier includes generous serverless function usage
- **Neon:** Free tier provides 0.5GB storage + 100 projects
- **This app:** ~341MB database ≈ $0 on Neon free tier (or ~$0.15/month with paid plan)

**Estimate:** Completely free on Neon free tier!

## Next Steps

- Monitor performance in Vercel Dashboard and Neon Dashboard
- Set up alerting for errors (optional)
- Plan for data updates
- Consider scaling to paid tiers if usage grows

## Support & Docs

- **Vercel:** [vercel.com/docs](https://vercel.com/docs)
- **Neon:** [neon.tech/docs](https://neon.tech/docs)
- **PostgreSQL:** [postgresql.org/docs](https://www.postgresql.org/docs/)
