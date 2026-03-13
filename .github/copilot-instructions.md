# BIN Search Web App - Project Instructions

## Project Overview
A secure, modern web application for searching Bank Identification Numbers (BINs) from a SQLite database. Features a single smart search button that validates input (6-11 digits) and returns results in a clean, responsive interface.

## Technology Stack
- **Backend:** Node.js with Express
- **Database:** SQLite3 (secure, server-side storage)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Data Import:** CSV to SQLite conversion via csv-parser
- **Styling:** Modern gradient design with Verdana sans-serif fonts

## Project Structure
```
binbase-search/
├── public/
│   ├── index.html        # Frontend UI with single search button
│   ├── style.css         # Modern gradient styling
│   └── script.js         # Frontend validation (6-11 digits)
├── data/
│   ├── bins_all.csv      # CSV source data
│   └── bins.db           # SQLite database (created by init-db.js)
├── server.js             # Express backend with database queries
├── init-db.js            # Database initialization script
├── package.json          # npm dependencies
├── README.md             # Full documentation
└── .gitignore
```

## Key Features
1. **Single Smart Search Button:** Input validation for 6-11 digits
2. **Client-Side Validation:** Red error if digits outside 6-11 range
3. **Database Security:** BIN data in SQLite, not exposed via web
4. **Server-Side Search:** All lookups happen on server
5. **Results Display:**
   - Green message with match count
   - Red "No matches found!" if no results
   - Formatted table with Verdana font for results
6. **Responsive Design:** Works on desktop and mobile

## Running the Application

### Prerequisites
- Node.js (v25.5.0+) and npm installed
- CSV file at `data/bins_all.csv`

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Initialize database from CSV
npm run init-db

# 3. Start server
npm start
```

The server will:
- Connect to SQLite database (`data/bins.db`)
- Display loaded record count
- Listen on http://localhost:3000

### Using the App
1. Open http://localhost:3000 in browser
2. Enter a BIN (6-11 digits)
3. Click "Search"
4. View results in table

## API Details

**POST** `/api/search`

Request:
```json
{
  "bin": "123456"
}
```

Response (valid input):
```json
{
  "count": 3,
  "matches": [...],
  "searchedBin": "123456",
  "binLength": 6
}
```

Error Response (invalid length):
```json
{
  "error": "Your BIN should be 6-11 digits!",
  "count": 0,
  "matches": []
}
```

## Security Features
- **Database Storage:** SQLite on server, not exposed to web
- **No In-Memory CSV:** Data converted to secure database at startup
- **Server-Side Search:** All queries processed server-side
- **Input Validation:** 6-11 digit restriction enforced
- **No Raw Data to Frontend:** Only formatted results sent to client

## Development Notes
- Run `npm run init-db` to reset/reimport database from CSV
- Database file: `data/bins.db` (SQLite)
- Frontend uses vanilla JS with no build step
- Search uses LIKE operator for prefix matching on first column
- Results limited to 100 matches per query

## Styling Details
- **Font:** Verdana, Segoe UI, system sans-serif stack
- **Colors:** Purple gradient (#667eea to #764ba2)
- **Feedback:** Green (#d4edda) for matches, Red (#f8d7da) for errors
- **Responsive:** Grid layout adapts to mobile (< 768px)

