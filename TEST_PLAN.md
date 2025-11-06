# Deeds App - End-to-End Test Plan

## Prerequisites
- [ ] Migrations 0012 and 0013 have been run
- [ ] App is running locally (`npm run start`) or deployed to Cloudflare

---

## Test Flow 1: User Registration & Authentication

### 1.1 Sign Up (New User)
**Page:** `/login.html` or signup form
**Steps:**
1. Enter name: "Test User"
2. Enter email: "test@example.com"
3. Enter password: "password123" (8+ chars)
4. Click "Sign Up"

**Expected:**
- ✅ Success message appears
- ✅ Session token stored in localStorage
- ✅ User redirected to dashboard

**Backend Check:**
```sql
SELECT * FROM users WHERE email='test@example.com';
-- Should show: name, email, password_hash, role='user', credits=0
```

---

### 1.2 Login (Existing User)
**Page:** `/login.html`
**Steps:**
1. Enter email: "test@example.com"
2. Enter password: "password123"
3. Click "Login"

**Expected:**
- ✅ "Welcome back, Test User!" message
- ✅ Profile data loaded (id, name, email, credits, completed deeds)
- ✅ Redirected to dashboard

---

## Test Flow 2: Deed Submission

### 2.1 Load Deed Catalog
**Page:** `/submit.html`
**Steps:**
1. Navigate to submit page
2. Observe deed cards loading

**Expected:**
- ✅ 7 deed cards displayed:
  - Support Hemp Farms in Haiti
  - Family Census
  - Sign a Petition for Local Reform
  - Donate or Invest in a Local Project
  - TikTok Challenge for Awareness
  - Neighborhood Clean-Up
  - Mentor a Student
- ✅ Each card shows: title, description, impact, duration

**API Check:**
```bash
curl https://your-app.workers.dev/api/deed_catalog
# Should return 7 deeds with id, title, description, impact, duration
```

---

### 2.2 Submit a Deed
**Page:** `/submit.html`
**Steps:**
1. Click on "Neighborhood Clean-Up" card (should highlight)
2. Enter proof URL: "https://example.com/proof.jpg"
3. Enter reflection: "Cleaned up 3 blocks with neighbors"
4. Click "Send for Verification"

**Expected:**
- ✅ Success message: "Deed submitted successfully! Awaiting verification."
- ✅ Form resets
- ✅ Deed card selection clears

**Backend Check:**
```sql
SELECT * FROM deeds WHERE user_id=1 ORDER BY created_at DESC LIMIT 1;
-- Should show:
--   title='Neighborhood Clean-Up'
--   description='Cleaned up 3 blocks with neighbors'
--   proof_url='https://example.com/proof.jpg'
--   status='pending'
--   impact='Environment'
--   duration='Half day'
```

---

## Test Flow 3: Admin Verification

### 3.1 Verify a Deed (Admin Only)
**Page:** `/verify.html`
**Prerequisites:** User must have `role='admin'` in database

**Steps:**
1. Load verify page
2. See list of pending deeds
3. Click "Verify" on the submitted deed

**Expected:**
- ✅ Deed status changes to "verified"
- ✅ User credits increment by 1
- ✅ verified_at timestamp recorded

**Backend Check:**
```sql
-- Check deed status
SELECT status, verified_at FROM deeds WHERE id=1;
-- Should show: status='verified', verified_at='2025-11-05 ...'

-- Check user credits
SELECT credits FROM users WHERE id=1;
-- Should show: credits=1 (incremented from 0)
```

---

## Test Flow 4: Leaderboard Display

### 4.1 View Leaderboard
**Page:** `/leaderboard.html`
**Steps:**
1. Navigate to leaderboard page

**Expected:**
- ✅ Users sorted by credits (highest first)
- ✅ Each row shows: rank, name, credits count, verified deeds count
- ✅ Example: "1. Test User | 1 credits | 1 deeds"

**API Check:**
```bash
curl https://your-app.workers.dev/api/leaderboard
# Should return array of users with:
# { id, name, region, sector, credits, verified, total }
```

---

## Test Flow 5: Profile View

### 5.1 View User Profile
**Page:** `/profile.html`
**Steps:**
1. Navigate to profile page with user_id in query: `/profile.html?user_id=1`

**Expected:**
- ✅ User name displayed
- ✅ Email displayed
- ✅ Total credits shown
- ✅ Total deeds count
- ✅ Verified deeds count

---

## Edge Cases & Error Handling

### E1: Duplicate Email Signup
**Test:** Try signing up with existing email
**Expected:** Error message "Email already registered."

### E2: Invalid Login Credentials
**Test:** Login with wrong password
**Expected:** Error message "Invalid credentials."

### E3: Deed Submission Without Selection
**Test:** Click submit without selecting a deed
**Expected:** Alert "⚠️ Please select a deed first."

### E4: Unauthorized Verification
**Test:** Non-admin user tries to access /verify.html
**Expected:** "admin access required" error (403)

### E5: Empty Leaderboard
**Test:** View leaderboard with no verified deeds
**Expected:** Message "No verified deeds yet."

---

## Performance Tests

### P1: Leaderboard Load Time
- Load `/leaderboard.html`
- Measure API response time for `/api/leaderboard`
- **Target:** < 500ms

### P2: Deed Catalog Load Time
- Load `/submit.html`
- Measure API response time for `/api/deed_catalog`
- **Target:** < 300ms

---

## Cross-Browser Testing
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Android Chrome)

---

## Test Data Cleanup

After testing, clean up test data:
```sql
DELETE FROM deeds WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%');
DELETE FROM users WHERE email LIKE 'test%';
```

---

## Automated Test Script Ideas

Consider creating automated tests for:
1. API endpoint response validation
2. Authentication flow
3. Deed submission and verification loop
4. Leaderboard ranking accuracy

---

## Sign-Off Checklist

- [ ] All 5 test flows pass
- [ ] All edge cases handled correctly
- [ ] Performance targets met
- [ ] Cross-browser compatibility verified
- [ ] Mobile responsiveness confirmed
- [ ] Security: SQL injection tests passed
- [ ] Security: XSS prevention validated
- [ ] Session token expiration works correctly
