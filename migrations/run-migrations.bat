@echo off
REM Batch script to run new migrations for Deeds App
REM Run this from the project root directory

echo ============================================
echo Running Deeds App Database Migrations
echo ============================================
echo.

echo [1/2] Creating deed_catalog table with seed data...
call npx wrangler d1 execute deeds-app-db --remote --file=./migrations/0012_create_deed_catalog.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Migration 0012 failed!
    pause
    exit /b 1
)
echo ✓ deed_catalog table created
echo.

echo [2/2] Adding impact and duration columns to deeds table...
call npx wrangler d1 execute deeds-app-db --remote --file=./migrations/0013_add_deeds_impact_duration.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Migration 0013 failed!
    pause
    exit /b 1
)
echo ✓ impact and duration columns added
echo.

echo ============================================
echo Verifying migrations...
echo ============================================
echo.

echo Checking deed_catalog table:
call npx wrangler d1 execute deeds-app-db --remote --command "SELECT COUNT(*) as deed_count FROM deed_catalog;"
echo.

echo Checking deeds table schema:
call npx wrangler d1 execute deeds-app-db --remote --command "PRAGMA table_info(deeds);"
echo.

echo ============================================
echo ✓ All migrations completed successfully!
echo ============================================
pause
