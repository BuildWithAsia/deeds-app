# Database Migrations

## Running Migrations

To apply these migrations to your Cloudflare D1 database, run them in order:

```bash
# Migration 12: Create deed_catalog table with seed data
wrangler d1 execute deeds-app-db --remote --file=./migrations/0012_create_deed_catalog.sql

# Migration 13: Add impact and duration to deeds table
wrangler d1 execute deeds-app-db --remote --file=./migrations/0013_add_deeds_impact_duration.sql
```

## Verify Migrations

```bash
# Check deed_catalog table
wrangler d1 execute deeds-app-db --remote --command "SELECT * FROM deed_catalog;"

# Check deeds table schema
wrangler d1 execute deeds-app-db --remote --command "PRAGMA table_info(deeds);"
```

## Local Development

For local development, use `--local` instead of `--remote`:

```bash
wrangler d1 execute deeds-app-db --local --file=./migrations/0012_create_deed_catalog.sql
wrangler d1 execute deeds-app-db --local --file=./migrations/0013_add_deeds_impact_duration.sql
```

## Current Schema

### Users Table
- id, email, password_hash, name, sector, region, verification_status, credits, role, created_at, verified

### Deeds Table
- id, user_id, title, proof_url, status, credits, created_at, verified_at, description, category, **impact**, **duration**

### Deed Catalog Table (NEW)
- id, title, description, impact, duration
