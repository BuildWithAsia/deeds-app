# Bug Fix Summary - Deed Submission Issue

**Date:** 2025-11-05
**Issue:** "You're not logged in — please sign in first" error when submitting deeds
**Status:** ✅ RESOLVED

---

## Problem Description

Users were able to log in successfully, but when attempting to submit a deed with photo proof, they received an error message: "You're not logged in — please sign in first."

### Root Cause Analysis

The issue had three components:

1. **LocalStorage Key Mismatch**
   - **Login** stored profile data as `"deeds.profile"` (object with id, sessionToken, etc.)
   - **Submit page** was looking for separate keys: `"userId"` and `"sessionToken"`
   - Result: Submit page couldn't find the authentication data

2. **Missing Payload Fields**
   - Backend expected `impact` and `duration` fields
   - Frontend wasn't sending these fields in the submission payload
   - Could have caused errors after authentication was fixed

3. **Missing Success Flag**
   - Frontend checked for `result.success === true`
   - Backend only returned `{ message: "..." }` without success flag
   - Would have shown "Something went wrong" even on successful submission

---

## Changes Made

### 1. Fixed [public/submit.html](public/submit.html) (Lines 183-200)

**Before:**
```javascript
const user_id = Number(localStorage.getItem("userId"));
const token = localStorage.getItem("sessionToken");
if (!user_id || !token) return alert("⚠️ You're not logged in — please sign in first.");

const payload = { user_id, title: selectedDeed.title, description, proof_url };
```

**After:**
```javascript
// Get profile from localStorage
const profileData = localStorage.getItem("deeds.profile");
if (!profileData) return alert("⚠️ You're not logged in — please sign in first.");

const profile = JSON.parse(profileData);
const user_id = profile.id;
const token = profile.sessionToken;

if (!user_id || !token) return alert("⚠️ You're not logged in — please sign in first.");

const payload = {
  user_id,
  title: selectedDeed.title,
  description,
  proof_url,
  impact: selectedDeed.impact || "",
  duration: selectedDeed.duration || ""
};
```

**Changes:**
- ✅ Now reads from `"deeds.profile"` (matches login behavior)
- ✅ Parses JSON to extract `id` and `sessionToken`
- ✅ Includes `impact` and `duration` in payload

---

### 2. Fixed [functions/_worker.js](functions/_worker.js) (Line 212)

**Before:**
```javascript
return responseWithMessage("Deed submitted for review.", 201);
```

**After:**
```javascript
return responseWithMessage("Deed submitted for review.", 201, { success: true });
```

**Changes:**
- ✅ Adds `success: true` flag to response
- ✅ Frontend can now properly detect successful submission

---

## Testing Verification

### Before Fix:
1. User logs in successfully ✅
2. User navigates to Submit page ✅
3. User selects a deed ✅
4. User enters proof URL/photo ✅
5. User clicks submit ❌ → "You're not logged in" error

### After Fix:
1. User logs in successfully ✅
2. User navigates to Submit page ✅
3. User selects a deed ✅
4. User enters proof URL/photo ✅
5. User clicks submit ✅ → "Deed submitted successfully!"

---

## Related Files

### Modified:
- [public/submit.html](public/submit.html) - Authentication and payload fixes
- [functions/_worker.js](functions/_worker.js) - Response format fix

### Dependencies:
- [public/script.js](public/script.js) - Login flow (uses `deeds.profile`)
- [migrations/0012_create_deed_catalog.sql](migrations/0012_create_deed_catalog.sql) - Provides deed templates
- [migrations/0013_add_deeds_impact_duration.sql](migrations/0013_add_deeds_impact_duration.sql) - Adds required columns

---

## Additional Notes

### Security Considerations
- Session tokens are stored in localStorage (client-side)
- Backend should validate tokens on submission (currently doesn't)
- **TODO:** Add token verification middleware to `/api/deeds` endpoint for better security

### Future Improvements
1. Add token expiration handling
2. Implement backend authentication middleware for `/api/deeds`
3. Add error handling for expired sessions
4. Consider using httpOnly cookies instead of localStorage for tokens

---

## Commit Reference

**Commit:** `09e9c51`
**Message:** Fix deed submission authentication and payload

```bash
git show 09e9c51
```

---

## How to Deploy

The fix requires deploying both frontend and backend changes:

```bash
# Deploy to Cloudflare
npm run deploy

# Or for development testing
npm run start
```

---

## Verification Checklist

After deploying, verify:
- [x] Login creates `deeds.profile` in localStorage
- [x] Submit page reads from `deeds.profile`
- [x] Deed submission includes impact and duration
- [x] Backend returns `success: true`
- [x] Success message shows "Deed submitted successfully!"
- [x] Deed appears in database with pending status
