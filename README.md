# GeoSmart Location Intelligence System

A production-grade spatial database system for intelligent business location analysis using PostgreSQL + PostGIS, Node.js, and React + Leaflet.js.

---

## Architecture Overview

```
geosmart/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── routes/             # API route definitions
│   │   ├── services/           # Business logic + spatial queries
│   │   ├── triggers/           # Trigger SQL (applied via migration)
│   │   ├── procedures/         # Stored procedure callers
│   │   └── middleware/         # Auth, error handling, logging
│   └── config/                 # DB config, env
├── frontend/                   # React + Leaflet.js
│   └── src/
│       ├── components/         # Map, Forms, Score panels
│       ├── hooks/              # Custom React hooks
│       ├── services/           # API client
│       └── styles/             # CSS modules
├── database/
│   ├── migrations/             # Ordered DDL scripts
│   ├── seeds/                  # Sample + simulated data
│   ├── functions/              # Stored procedures / functions
│   └── triggers/               # Trigger definitions
└── docs/                       # ER diagram description
```

---

## Prerequisites

- PostgreSQL 14+ with PostGIS 3.x
- Node.js 18+
- osm2pgsql (optional, for real OSM import)

---

## Setup Instructions

### 1. PostgreSQL + PostGIS

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib postgis

# macOS (Homebrew)
brew install postgresql postgis

# Create database
psql -U postgres -c "CREATE DATABASE geosmart;"
psql -U postgres -d geosmart -c "CREATE EXTENSION postgis;"
psql -U postgres -d geosmart -c "CREATE EXTENSION postgis_topology;"
```

### 2. Run Database Migrations (in order)

```bash
psql -U postgres -d geosmart -f database/migrations/01_schema.sql
psql -U postgres -d geosmart -f database/migrations/02_spatial_tables.sql
psql -U postgres -d geosmart -f database/functions/03_stored_procedures.sql
psql -U postgres -d geosmart -f database/triggers/04_triggers.sql
psql -U postgres -d geosmart -f database/seeds/05_seed_data.sql
```

### 3. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials
npm install
npm run dev
```

### 4. Frontend

```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000

---

## OSM Data Import (Optional)

```bash
# Download OSM extract for your city (e.g., Chennai, India)
wget https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf

# Import with osm2pgsql
osm2pgsql -d geosmart -U postgres --slim --hstore \
  -S /usr/share/osm2pgsql/default.style \
  southern-zone-latest.osm.pbf

# Then run the OSM cleaner
psql -U postgres -d geosmart -f database/migrations/06_osm_cleaner.sql
```

---

## Key DBMS Concepts Demonstrated

| Concept | Implementation |
|---|---|
| Spatial Queries | ST_DWithin, ST_Within, ST_Intersects, ST_Distance |
| Weak Entity | analysis_request depends on app_user |
| Derived Attributes | final_score, competition_density computed at query time |
| 3NF Normalization | No transitive dependencies; junction tables for M:N |
| Triggers | Auto-block oversaturated areas; recalculate scores |
| Stored Procedures | 5 complex spatial analysis functions |
| CHECK Constraints | Score ranges, coordinate bounds, enum validation |
| Window Functions | RANK() OVER for location ranking |
| CTEs | Multi-step spatial analysis pipelines |
| Transactions | Atomic business insertion with score recalculation |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/analyze | Analyze a clicked map location |
| GET | /api/businesses | List all businesses |
| POST | /api/businesses | Add a new business |
| PUT | /api/businesses/:id | Update business |
| DELETE | /api/businesses/:id | Delete business |
| GET | /api/zones | Get all zones |
| GET | /api/business-types | List business types |
| GET | /api/analysis/best-locations/:typeId | Best locations for type |
| GET | /api/analysis/top-10 | Top ranked locations |
| GET | /api/analysis/underserved | Underserved areas |
| POST | /api/analysis/compare | Compare two locations |
| GET | /api/analysis/low-competition | Low competition zones |
