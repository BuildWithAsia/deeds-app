# How to Run Database Migrations

Since Node.js is not available in the Git Bash environment, you'll need to run the migrations from a different terminal.

## Option 1: PowerShell (Recommended for Windows)

1. Open **PowerShell** (not Git Bash)
2. Navigate to the project root:
   ```powershell
   cd C:\Users\algrady\Downloads\unzipped\deeds-app
   ```
3. Run the PowerShell migration script:
   ```powershell
   .\migrations\run-migrations.ps1
   ```

## Option 2: Command Prompt (Windows CMD)

1. Open **Command Prompt** (cmd.exe)
2. Navigate to the project root:
   ```cmd
   cd C:\Users\algrady\Downloads\unzipped\deeds-app
   ```
3. Run the batch script:
   ```cmd
   migrations\run-migrations.bat
   ```

## Option 3: Manual Commands (Any Terminal with Node.js)

If you have Node.js installed, run these commands one by one:

```bash
# Migration 12: Create deed_catalog table
npx wrangler d1 execute deeds-app-db --remote --file=./migrations/0012_create_deed_catalog.sql

# Migration 13: Add impact and duration columns
npx wrangler d1 execute deeds-app-db --remote --file=./migrations/0013_add_deeds_impact_duration.sql

# Verify migrations
npx wrangler d1 execute deeds-app-db --remote --command "SELECT COUNT(*) FROM deed_catalog;"
npx wrangler d1 execute deeds-app-db --remote --command "PRAGMA table_info(deeds);"
```

## Option 4: Via Cloudflare Dashboard

If Wrangler is not working, you can run the SQL manually via the Cloudflare dashboard:

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **D1**
3. Select your database: **deeds-app-db**
4. Click **Console** tab
5. Copy and paste the contents of these files:
   - `migrations/0012_create_deed_catalog.sql`
   - `migrations/0013_add_deeds_impact_duration.sql`
6. Click **Execute**

## Verification

After running migrations, verify they worked:

### Check deed_catalog table:
```sql
SELECT * FROM deed_catalog;
```
**Expected:** 7 rows with deed templates

### Check deeds table has new columns:
```sql
PRAGMA table_info(deeds);
```
**Expected:** Should show `impact` and `duration` columns in the list

---

## Troubleshooting

### "npx: command not found"
- Node.js is not installed or not in PATH
- Try using PowerShell or CMD instead of Git Bash
- Or install Node.js from https://nodejs.org/

### "wrangler: command not found"
- Wrangler is not installed
- Install it: `npm install -g wrangler`
- Or use `npx wrangler` instead

### Authentication error
- You may need to log in to Wrangler first:
  ```bash
  npx wrangler login
  ```

---

## What These Migrations Do

### Migration 0012: Create deed_catalog table
Creates a new table to store predefined deed templates with 7 seed records:
- Support Hemp Farms in Haiti
- Family Census
- Sign a Petition for Local Reform
- Donate or Invest in a Local Project
- TikTok Challenge for Awareness
- Neighborhood Clean-Up
- Mentor a Student

### Migration 0013: Add impact and duration to deeds
Adds two new columns to the existing `deeds` table:
- `impact` (TEXT) - Category like "Environment", "Education", etc.
- `duration` (TEXT) - Time estimate like "Half day", "1-2 hours", etc.

These columns store metadata from the deed_catalog when users submit deeds.
