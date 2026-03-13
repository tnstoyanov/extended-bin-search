# BIN Search Web App - PostgreSQL Edition

A modern, secure web application for searching Bank Identification Numbers (BINs) using PostgreSQL for persistent data storage. Perfect for deployment on Vercel.

## Features

- **Smart Search:** Enter a BIN and search by exact prefix (6-11 digits)
- **Input Validation:** Real-time validation for 6-11 digit range
- **PostgreSQL Backend:** Scalable relational database with persistent storage
- **Server-Side Search:** All queries processed securely on the server
- **Fast Lookups:** Indexed database searches for instant results
- **Responsive Design:** Works seamlessly on desktop and mobile devices
- **Modern UI:** Clean gradient interface with helpful feedback messages

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL (persistent, scalable)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Deployment:** Vercel + Vercel Postgres

## Project Structure

```
extended-bin-search/
├── public/
│   ├── index.html        # Frontend UI
│   ├── style.css         # Styling
│   └── script.js         # Client-side logic
├── data/
│   └── bins_all.csv      # BIN data source (for import)
├── server.js             # Express backend with PostgreSQL
├── init-db-postgres.js   # Database initialization script
├── .env.example          # Environment variables template
├── vercel.json           # Vercel deployment config
├── package.json          # Dependencies
└── README.md            # This file
```

## Local Setup

### Prerequisites

- Node.js v18+ 
- PostgreSQL 12+ running locally
- npm or yarn

### Development Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/tnstoyanov/extended-bin-search.git
   cd extended-bin-search
   npm install
   ```

2. **Set up database connection:**
   
   Create `.env.local` in project root:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/bindb
   NODE_ENV=development
   PORT=3000
   ```

3. **Create PostgreSQL database:**
   ```bash
   createdb bindb
   ```

4. **Initialize the database with BIN data:**
   ```bash
   npm run init-db
   ```
   This imports all BINs from `data/bins_all.csv` into PostgreSQL

5. **Start the development server:**
   ```bash
   npm start
   ```
   Server runs at `http://localhost:3000`

## Deployment on Vercel

### Step 1: Create Vercel Postgres Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Storage** → **Create Database** → **Select Postgres**
3. Choose your region and create the database
4. Copy the connection string

### Step 2: Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Deploy from GitHub:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select your GitHub repository
   - Click **Deploy**

3. **Set environment variables:**
   - Go to your Vercel project settings
   - Navigate to **Settings** → **Environment Variables**
   - Add `DATABASE_URL` with your Postgres connection string from Step 1
   - Redeploy

### Step 3: Initialize Database on Vercel

After deployment, you need to populate the database once:

```bash
# Run the init script against your Vercel database
DATABASE_URL="your-vercel-postgres-url" npm run init-db
```

Or use the Vercel CLI:
```bash
vercel env pull
npm run init-db
```

## API Reference

### POST /api/search

Search for BINs by prefix.

**Request:**
```json
{
  "bin": "556363"
}
```

**Response (Success):**
```json
{
  "count": 5,
  "matches": [
    {
      "id": 12345,
      "bin": "556363",
      "card_brand": "MASTERCARD",
      "issuer": "Example Bank",
      "card_type": "CREDIT",
      "card_level": "PREMIUM",
      "country_name": "United States",
      "country_code_a2": "US",
      ...
    }
  ],
  "searchedBin": "556363",
  "binLength": 6
}
```

**Response (Invalid Input):**
```json
{
  "error": "Your BIN should be 6-11 digits!",
  "count": 0,
  "matches": []
}
```

## Database Schema

```sql
CREATE TABLE bins (
  id SERIAL PRIMARY KEY,
  bin VARCHAR(11) NOT NULL,
  card_brand VARCHAR(255),
  issuer VARCHAR(255),
  card_type VARCHAR(255),
  card_level VARCHAR(255),
  country_name VARCHAR(255),
  country_code_a2 VARCHAR(2),
  country_code_a3 VARCHAR(3),
  country_code_numeric VARCHAR(3),
  bank_website VARCHAR(255),
  bank_phone VARCHAR(255),
  pan_length VARCHAR(255),
  personal_commercial VARCHAR(255),
  regulated VARCHAR(255)
);

CREATE INDEX idx_bins_prefix ON bins (bin);
```

## CSV Data Format

Your `data/bins_all.csv` must have these columns (semicolon-separated):

```
BIN;CardBrand;Issuer;CardType;CardLevel;CountryName;CountryCodeA2;CountryCodeA3;CountryCodeNumeric;BankWebsite;BankPhone;PANLength;PersonalCommercial;Regulated
```

Example:
```
556363;MASTERCARD;Example Bank;CREDIT;PREMIUM;United States;US;USA;840;;;16;COMMERCIAL;N
```

## Running Admin Tasks

### Reset Database

To clear and reimport all data:

```bash
DATABASE_URL="your-connection-string" npm run init-db
```

### Check Database

Connect directly to PostgreSQL:

```bash
psql $DATABASE_URL
SELECT COUNT(*) FROM bins;
```

## Security

- **Persistent Storage:** Data stored securely in PostgreSQL (not ephemeral)
- **Server-Side Processing:** All searches happen server-side, never on client
- **Input Validation:** BINs validated to 6-11 digits before searching
- **Connection Pooling:** Efficient database connections with automatic reuse

## Performance Notes

- The app uses indexed lookups on the `bin` column for fast prefix searches
- Results are limited to 100 matches per query
- Database connection pooling is configured for optimal performance

## Troubleshooting

### "Database connection failed"
- Verify `DATABASE_URL` is correctly set in `.env` or Vercel environment variables
- Check PostgreSQL is running (locally) or connection string is valid (Vercel)

### "bins table not found"
- Run `npm run init-db` to create the table and import data
- Ensure CSV file exists at `data/bins_all.csv`

### Slow searches
- Check that the index on `bins.bin` column exists
- Verify database connection pool is configured

## License

ISC

## Support

For issues and questions, open an issue on GitHub.
  - Adding HTTPS
  - Compressing database with encryption at rest
