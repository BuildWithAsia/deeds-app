# Schema Validation Report

## ✅ Schema Audit Complete

### Database Tables vs Backend Code

#### **Users Table**
**Schema Columns:**
- id, email, password_hash, verified, created_at, name, sector, region, verification_status, credits, role

**Backend Usage:** ✅ All columns properly used
- Line 151: `SELECT id FROM users WHERE email=?1`
- Line 156: `INSERT INTO users (name,email,password_hash,role,verification_status,created_at)`
- Line 173-175: `SELECT u.id,u.name,u.email,u.password_hash,u.role,u.credits` (login query)
- Line 242: `SELECT u.id,u.name,u.region,u.sector,u.credits` (leaderboard)
- Line 278: `SELECT u.id,u.name,u.email,u.credits` (profile)

**Status:** ✅ No mismatches

---

#### **Deeds Table**
**Current Schema:**
- id, user_id, title, proof_url, status, credits, created_at, verified_at, description, category

**After Migration 0013 (NEW):**
- id, user_id, title, proof_url, status, credits, created_at, verified_at, description, category, **impact**, **duration**

**Backend Usage:**
- Line 208: `INSERT INTO deeds (user_id,title,description,impact,duration,status,created_at)` ⚠️ Requires migration 0013
- Line 225: `SELECT id,user_id,status FROM deeds WHERE id=?1`
- Line 229: `UPDATE deeds SET status='verified',verified_at=datetime('now') WHERE id=?1`
- Line 232: `UPDATE users SET credits=credits+1 WHERE id=?1`

**Status:** ⚠️ **Requires migration 0013 to add impact and duration columns**

---

#### **Deed Catalog Table**
**Current Schema:** ❌ **DOES NOT EXIST**

**Required Schema (Migration 0012):**
- id, title, description, impact, duration

**Backend Usage:**
- Line 267: `SELECT id,title,description,impact,duration FROM deed_catalog ORDER BY id ASC` ⚠️ Requires migration 0012

**Status:** ❌ **Requires migration 0012 to create table and seed data**

---

## Issues Found & Resolutions

### 🔴 Critical Issues (Blocking)
1. **deed_catalog table missing**
   - **Impact:** `/api/deed_catalog` endpoint will fail, blocking deed submission UI
   - **Resolution:** Run migration 0012 ✅ Created

2. **deeds table missing impact/duration columns**
   - **Impact:** Deed submissions will fail with SQL errors
   - **Resolution:** Run migration 0013 ✅ Created

### 🟡 Minor Issues (Non-blocking)
None found. All other queries align with existing schema.

---

## Migration Checklist

- [ ] Run `migrations/run-migrations.bat` (Windows) or `migrations/run-migrations.sh` (Mac/Linux)
- [ ] Verify deed_catalog has 7 seed records
- [ ] Verify deeds table has impact and duration columns
- [ ] Test `/api/deed_catalog` endpoint
- [ ] Test deed submission flow

---

## Backend Endpoints Schema Map

| Endpoint | Query | Required Columns | Status |
|----------|-------|------------------|---------|
| `POST /api/auth/signup` | INSERT users | name, email, password_hash, role, verification_status, created_at | ✅ |
| `POST /api/auth/login` | SELECT users + JOIN deeds | id, name, email, password_hash, role, credits | ✅ |
| `POST /api/deeds` | INSERT deeds | user_id, title, description, impact, duration, status, created_at | ⚠️ Needs migration 13 |
| `POST /api/verify` | UPDATE deeds + users | deeds.status, deeds.verified_at, users.credits | ✅ |
| `GET /api/deed_catalog` | SELECT deed_catalog | id, title, description, impact, duration | ⚠️ Needs migration 12 |
| `GET /api/leaderboard` | SELECT users + JOIN deeds | id, name, region, sector, credits | ✅ |
| `GET /api/profile` | SELECT users + JOIN deeds | id, name, email, credits | ✅ |

---

## Summary

**Total Issues:** 2
**Critical:** 2 (both resolved with migrations 12 & 13)
**Minor:** 0

**Action Required:** Run the new migrations before deploying or testing.
