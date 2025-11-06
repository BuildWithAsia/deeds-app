#!/bin/bash
# Shell script to run new migrations for Deeds App
# Run this from the project root directory

echo "============================================"
echo "Running Deeds App Database Migrations"
echo "============================================"
echo ""

echo "[1/2] Creating deed_catalog table with seed data..."
npx wrangler d1 execute deeds-app-db --remote --file=./migrations/0012_create_deed_catalog.sql
if [ $? -ne 0 ]; then
    echo "ERROR: Migration 0012 failed!"
    exit 1
fi
echo "✓ deed_catalog table created"
echo ""

echo "[2/2] Adding impact and duration columns to deeds table..."
npx wrangler d1 execute deeds-app-db --remote --file=./migrations/0013_add_deeds_impact_duration.sql
if [ $? -ne 0 ]; then
    echo "ERROR: Migration 0013 failed!"
    exit 1
fi
echo "✓ impact and duration columns added"
echo ""

echo "============================================"
echo "Verifying migrations..."
echo "============================================"
echo ""

echo "Checking deed_catalog table:"
npx wrangler d1 execute deeds-app-db --remote --command "SELECT COUNT(*) as deed_count FROM deed_catalog;"
echo ""

echo "Checking deeds table schema:"
npx wrangler d1 execute deeds-app-db --remote --command "PRAGMA table_info(deeds);"
echo ""

echo "============================================"
echo "✓ All migrations completed successfully!"
echo "============================================"
