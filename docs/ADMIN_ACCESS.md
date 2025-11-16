# Admin Access Guide

## Default Admin Credentials

The application includes a default admin user for testing and development:

- **Email**: `admin@deeds.local`
- **Password**: `admin123`
- **Role**: `admin`

## Logging In as Admin

1. Navigate to `/login.html`
2. Enter the admin credentials
3. You will be automatically redirected to `/admin/dashboard.html`

## Admin Features

The admin dashboard provides access to:

- **Verification Queue**: Review and approve/reject pending deed submissions
- **User Management**: View active users and their statistics
- **Analytics**: Track platform metrics (coming soon)

## Troubleshooting

### "Invalid credentials" Error

If you get an "Invalid credentials" error when trying to log in:

1. The admin user password hash may be incorrect in the database
2. Run the following migration to fix it:

```bash
npx wrangler d1 execute DEEDS_DB --local --file=migrations/0017_fix_admin_password.sql
```

For remote/production database:

```bash
npx wrangler d1 execute DEEDS_DB --remote --file=migrations/0017_fix_admin_password.sql
```

### Manually Updating Password Hash

If you need to manually update the admin password hash:

```bash
npx wrangler d1 execute DEEDS_DB --local --command="UPDATE users SET password_hash='240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' WHERE email='admin@deeds.local';"
```

The hash `240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9` is the SHA-256 hash of `admin123`.

### Creating Additional Admin Users

To promote an existing user to admin:

```bash
npx wrangler d1 execute DEEDS_DB --local --command="UPDATE users SET role='admin' WHERE email='user@example.com';"
```

## Security Notes

⚠️ **Important**: The default admin credentials should be changed in production:

1. Create a new admin user with a secure password
2. Remove or disable the default admin account
3. Use environment-specific credentials

## Password Hashing

Passwords are hashed using SHA-256. To generate a password hash:

```bash
echo -n "your_password" | sha256sum
```

Then use the resulting hash in SQL UPDATE statements.
