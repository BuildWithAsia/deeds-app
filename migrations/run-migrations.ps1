# PowerShell script to run new migrations for Deeds App
# Run this from the project root directory

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Running Deeds App Database Migrations" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Creating deed_catalog table with seed data..." -ForegroundColor Yellow
npx wrangler d1 execute deeds-app-db --remote --file=./migrations/0012_create_deed_catalog.sql
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Migration 0012 failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✓ deed_catalog table created" -ForegroundColor Green
Write-Host ""

Write-Host "[2/2] Adding impact and duration columns to deeds table..." -ForegroundColor Yellow
npx wrangler d1 execute deeds-app-db --remote --file=./migrations/0013_add_deeds_impact_duration.sql
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Migration 0013 failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✓ impact and duration columns added" -ForegroundColor Green
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Verifying migrations..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking deed_catalog table:" -ForegroundColor Yellow
npx wrangler d1 execute deeds-app-db --remote --command "SELECT COUNT(*) as deed_count FROM deed_catalog;"
Write-Host ""

Write-Host "Checking deeds table schema:" -ForegroundColor Yellow
npx wrangler d1 execute deeds-app-db --remote --command "PRAGMA table_info(deeds);"
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host "✓ All migrations completed successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Read-Host "Press Enter to exit"
