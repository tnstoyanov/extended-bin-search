# Vercel Postgres Setup Guide

Your app is now deployed to Vercel! Now you need to set up the Postgres database.

## Step 1: Create Vercel Postgres Database

1. Go to https://vercel.com/dashboard
2. Select your project: **binbase-search**
3. Click **Settings** → **Storage**
4. Click **Create Database** → **Postgres**
5. Click **Create** and follow the prompts
6. Once created, Vercel will automatically add `POSTGRES_PRISMA_URL` to your environment variables

## Step 2: Export Data to Vercel Postgres

Once you have the connection string, run this command locally:

```bash
export POSTGRES_PRISMA_URL="<paste-your-connection-string-here>"
npm run import-postgres
```

Or add it to `.env.local`:
```
POSTGRES_PRISMA_URL=<connection-string>
```

Then run:
```bash
npm run import-postgres
```

This will export all 3,291,459 BIN records from your local database to Vercel Postgres.

## Step 3: Redeploy to Activate Postgres

Once import completes successfully, redeploy to production:

```bash
vercel --prod --yes
```

Your app will automatically detect the `POSTGRES_PRISMA_URL` environment variable and use Postgres instead of SQLite.

## Verification

Check that it's working:

```bash
curl https://binbase-search.vercel.app/api/health
```

You should see:
```json
{
  "status": "ok",
  "database": "postgres",
  "recordCount": 3291459
}
```

## Troubleshooting

If `npm run import-postgres` fails:
- Make sure `POSTGRES_PRISMA_URL` is set correctly
- Check that your local SQLite database exists at `data/bins.db`
- Try running it again - the script is idempotent
