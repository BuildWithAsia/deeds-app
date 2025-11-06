# Deployment Checklist - Fix Deed Submission 500 Error

## Problem Identified

**Error:** `500 Internal Server Error` when submitting deeds
**Root Cause:** Backend was throwing unhandled errors and returning HTML error pages instead of JSON
**Result:** Frontend got "Unexpected token '<'" error trying to parse HTML as JSON

---

## Fixes Applied

### 1. Backend Error Handling ([functions/_worker.js](functions/_worker.js))
- ✅ Added try-catch around database INSERT operation
- ✅ Added global error handler in fetch() function
- ✅ Backend now always returns JSON (never HTML error pages)
- ✅ Detailed error messages logged to console

### 2. Frontend Debugging ([public/submit.html](public/submit.html))
- ✅ Removed undefined `uploadedFileUrl` variable
- ✅ Added comprehensive console logging
- ✅ Added validation for proof_url
- ✅ Better error messages

### 3. Commits Made
```
09e9c51 - Fix deed submission authentication and payload
7964cf3 - Add comprehensive debugging to deed submission
0de78a2 - Add error handling to backend deed submission
```

---

## Deploy Instructions

### Step 1: Deploy to Cloudflare

```bash
npm run deploy
```

**Wait for deployment to complete** (usually 10-30 seconds)

---

### Step 2: Test the Submission

1. **Clear browser cache** (or hard refresh: Ctrl+Shift+R / Cmd+Shift+R)
2. **Open DevTools** (F12) → Console tab
3. **Go to** https://deeds-app.asialakaygrady-6d4.workers.dev/submit
4. **Select a deed** (click on a card)
5. **Enter proof URL:** `https://photos.app.goo.gl/EeHDKLudZ99QkE1V7`
6. **Click "Send for Verification"**

---

### Step 3: Check Console Output

#### ✅ If Successful:
```
🚀 Submit button clicked
✅ Selected deed: {title: "Support Hemp Farms in Haiti", ...}
✅ Proof URL: https://photos.app.goo.gl/...
✅ Profile data found
✅ User ID: 6 Token exists: true
📤 Payload: {user_id: 6, title: "...", ...}
📡 Response status: 201
📥 Server Response: {message: "Deed submitted for review.", success: true}
✅ Submission successful!
```

#### ❌ If Still Failing:
You'll now see a **specific error message** instead of HTML, for example:
```
📡 Response status: 500
📥 Server Response: {message: "Database error: ...", error: "..."}
❌ Submission failed: Database error: ...
```

This will tell us exactly what's wrong!

---

## Possible Remaining Issues

### Issue 1: Database Column Mismatch
**Symptom:** Error about unknown column
**Solution:** Migrations 12 & 13 need to be applied to production database

**Check with:**
```bash
# Verify deed_catalog exists
npx wrangler d1 execute deeds-app-db --remote --command "SELECT COUNT(*) FROM deed_catalog;"

# Verify deeds has impact/duration columns
npx wrangler d1 execute deeds-app-db --remote --command "PRAGMA table_info(deeds);"
```

---

### Issue 2: User ID Doesn't Exist
**Symptom:** Foreign key constraint error
**Solution:** User needs to exist in users table

**Check with:**
```bash
npx wrangler d1 execute deeds-app-db --remote --command "SELECT id, name, email FROM users WHERE id=6;"
```

---

### Issue 3: Database Connection Error
**Symptom:** "database not found" or connection error
**Solution:** Check wrangler.toml has correct database binding

**Verify in [wrangler.toml](wrangler.toml):**
```toml
[[d1_databases]]
binding = "DEEDS_DB"
database_name = "deeds-app-db"
database_id = "6f28b6d0-bd5c-4e30-9703-a13079d9d44f"
```

---

## After Successful Submission

### Verify Deed Was Created:
```bash
# Check latest deed
npx wrangler d1 execute deeds-app-db --remote --command "SELECT * FROM deeds ORDER BY created_at DESC LIMIT 1;"
```

### Expected Result:
```
id | user_id | title | description | proof_url | status | impact | duration | created_at
1  | 6       | Support Hemp Farms... | | https://photos... | pending | Environment | Half day | 2025-11-05...
```

---

## Rollback Plan

If something breaks:

```bash
# Revert to previous working commit
git log --oneline -5
git revert 0de78a2  # or whichever commit caused issues
npm run deploy
```

---

## Success Criteria

- [ ] `npm run deploy` completes without errors
- [ ] Submit page loads without console errors
- [ ] Deed cards display (7 deeds)
- [ ] Can select a deed (card highlights)
- [ ] Can enter proof URL
- [ ] Submit button works (shows alert)
- [ ] Console shows "✅ Submission successful!"
- [ ] Alert says "Deed submitted successfully!"
- [ ] Deed appears in database with status='pending'

---

## Next Steps After Fix

1. **Test verification flow** (admin verifying deeds)
2. **Check leaderboard** (credits should update)
3. **Test profile page** (deed count should show)
4. **Complete Day 6-7 tasks** (localization, branding)
5. **Record demo video** (Day 9)

---

## Need Help?

If you get a **specific error message** after deploying, share:
1. The console output (all messages)
2. The error message from the server response
3. Screenshot of the console

This will help pinpoint the exact issue!
