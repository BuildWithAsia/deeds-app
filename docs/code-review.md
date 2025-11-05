# Code Review Summary

## Critical Issues

### Missing `reward` column in `deeds` queries
- Both the deed listing handler and the admin verification handler query a `reward` column on the `deeds` table, but no migration adds this field. Any request that hits these code paths will cause a SQL error ("no such column: reward").
- `functions/_worker.js` lines 586-647 and 808-834 expect the column, yet the migrations under `migrations/` never introduce it.

### Deed creation trusts client-supplied `user_id`
- `handleCreateDeed` accepts a `user_id` in the JSON payload and only checks that the user exists. There is no session validation to ensure the caller owns that account, so anyone can submit deeds on behalf of any user.
- `functions/_worker.js` lines 437-523 show the unchecked `user_id` usage.

## Security Concerns

### Password hashing is not production-grade
- User passwords are hashed with a raw SHA-256 digest without a salt or work factor, which is trivial to brute-force. A password hashing algorithm such as Argon2id or bcrypt should be used instead.
- `functions/_worker.js` lines 215-221 implement the current hashing routine.

### Sensitive data logged on login
- Successful logins log both the submitted and stored password hashes. This leaks enough information for offline attacks if logs are ever exposed.
- `functions/_worker.js` lines 389-392 emit the hashes to the logs.

## Recommendations

1. Add a migration that introduces a `reward` column (with a sensible default) or update the code to stop referencing it if it is no longer needed.
2. Require authenticated sessions for deed submission. Instead of trusting a client-provided `user_id`, derive it from the verified session token.
3. Replace the SHA-256 helper with a slow password hashing algorithm (bcrypt, scrypt, or Argon2) and store a per-user salt/work factor.
4. Remove sensitive credential logs; rely on a constant-time comparison and audit logging that does not expose hashes.
