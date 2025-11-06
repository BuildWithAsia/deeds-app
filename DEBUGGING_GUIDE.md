# Debugging Guide - Deed Submission

## How to Check What's Happening

### 1. Open Browser Developer Tools

**Chrome/Edge:**
- Press `F12` or `Right-click` → `Inspect`
- Click the **Console** tab

**Firefox:**
- Press `F12` or `Right-click` → `Inspect Element`
- Click the **Console** tab

### 2. Try Submitting a Deed

With the console open, follow these steps:

1. **Select a deed** from the list
2. **Enter a proof URL** (e.g., `https://photos.app.goo.gl/LWZsMh4KVnrhGSB9`)
3. **Click "Send for Verification"**

### 3. Watch the Console Output

You should see messages like this:

#### ✅ **Successful Submission:**
```
🚀 Submit button clicked
✅ Selected deed: {title: "TikTok Challenge for Awareness", ...}
✅ Proof URL: https://photos.app.goo.gl/LWZsMh4KVnrhGSB9
✅ Profile data found
✅ User ID: 1 Token exists: true
📤 Payload: {user_id: 1, title: "...", description: "...", proof_url: "...", impact: "...", duration: "..."}
📡 Response status: 201
📥 Server Response: {message: "Deed submitted for review.", success: true}
✅ Submission successful!
```

#### ❌ **Common Errors:**

**Problem: Not Logged In**
```
🚀 Submit button clicked
✅ Selected deed: {...}
✅ Proof URL: https://...
❌ No profile in localStorage
```
**Solution:** Log in first at `/login.html`

---

**Problem: No Deed Selected**
```
🚀 Submit button clicked
❌ No deed selected
```
**Solution:** Click on one of the deed cards before submitting

---

**Problem: No Proof URL**
```
🚀 Submit button clicked
✅ Selected deed: {...}
❌ No proof URL provided
```
**Solution:** Fill in the "Proof Link" field

---

**Problem: Network Error**
```
🚀 Submit button clicked
✅ Selected deed: {...}
✅ Proof URL: https://...
✅ Profile data found
✅ User ID: 1 Token exists: true
📤 Payload: {...}
❌ Network error: TypeError: Failed to fetch
```
**Solution:**
- Check if the app is running (`npm run start`)
- Check your internet connection
- Make sure you're accessing the correct URL

---

**Problem: Server Error**
```
📡 Response status: 400
📥 Server Response: {message: "Missing deed data."}
❌ Submission failed: Missing deed data.
```
**Solution:** This means the backend rejected the data. Check:
- All required fields are present in payload
- Database migrations are applied

---

## Manual Testing Checklist

### Before Testing:
- [ ] Migrations 0012 and 0013 are applied
- [ ] Latest code is deployed (`npm run deploy`)
- [ ] You are logged in

### Test Steps:
1. [ ] Open `/submit.html`
2. [ ] Open browser DevTools (F12) → Console tab
3. [ ] Verify 7 deeds load (check console for deed catalog fetch)
4. [ ] Click on a deed card (should highlight)
5. [ ] Enter proof URL: `https://photos.app.goo.gl/LWZsMh4KVnrhGSB9`
6. [ ] (Optional) Enter reflection text
7. [ ] Click "Send for Verification"
8. [ ] Watch console for logs
9. [ ] If successful, check alert message

### After Submission:
- [ ] Verify deed appears in database
- [ ] Check `/verify.html` for pending deed (if admin)
- [ ] Check `/leaderboard.html` after verification

---

## What Each Console Log Means

| Message | Meaning |
|---------|---------|
| `🚀 Submit button clicked` | Form submission started |
| `✅ Selected deed: {...}` | A deed was selected before submission |
| `✅ Proof URL: https://...` | Proof link was provided |
| `✅ Profile data found` | User is logged in (has session) |
| `✅ User ID: X Token exists: true` | Valid session token found |
| `📤 Payload: {...}` | Data being sent to server |
| `📡 Response status: 201` | Server accepted the request |
| `📥 Server Response: {...}` | Server's reply |
| `✅ Submission successful!` | Deed was created successfully |
| `❌ ...` | Error occurred (read the message) |

---

## Still Not Working?

### Take a Screenshot of:
1. The console output (all messages)
2. The Network tab (filter by "deeds")
3. The Application tab → Local Storage → `deeds.profile`

### Share This Information:
- What step fails?
- What error message do you see?
- What's in the console?
- Screenshots of the above

---

## Quick Fixes

### Clear Session and Re-login:
```javascript
// Run in console:
localStorage.clear();
// Then go to /login.html and sign in again
```

### Check if Deeds Load:
```javascript
// Run in console:
fetch('/api/deed_catalog')
  .then(r => r.json())
  .then(data => console.log('Deeds:', data));
// Should show 7 deeds
```

### Check Your Profile:
```javascript
// Run in console:
JSON.parse(localStorage.getItem('deeds.profile'));
// Should show: {id, name, email, sessionToken, ...}
```

---

## Need More Help?

If you're still stuck, the console logs will tell us exactly where the problem is. Look for the last `✅` message and the first `❌` message - that's where it's failing.
