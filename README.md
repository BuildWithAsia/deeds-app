# Deeds App

The Deeds App is an MVP that helps neighbors document good deeds, verify contributions, and celebrate impact on a shared leaderboard. It is built with a Cloudflare Worker backend and a Tailwind-powered frontend.

**Live Production**: https://deeds-app.asialakaygrady-6d4.workers.dev

## Key links
- [Sprint tracker and daily checklist](Sprint_README.md)
- [Project documentation overview](docs/creadme.md)
- [Cloudflare deployment notes](docs/d1_migration_commands.md)

## Quick start
```bash
npm install
npm run start
```

The development server runs through `wrangler dev`, serving the static assets from the `public/` directory and exposing the Worker API routes.

## Project structure
```
functions/       # Cloudflare Worker handlers and API routes
public/          # Static frontend pages and assets
scripts/         # Utility scripts used for deployment helpers
migrations/      # D1 database schema migrations
```

## Worker API endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/auth/signup` | Registers a new neighbor profile, hashes the provided password, stores the record in D1, and returns the persisted profile payload. Sets secure session cookie. |
| `POST` | `/api/auth/login` | Authenticates an existing profile by verifying the submitted password, automatically upgrading legacy hashes, and responding with the stored profile. Sets secure session cookie. |
| `POST` | `/api/auth/logout` | Clears the session cookie to log out the user. |
| `GET` | `/api/deeds` | Lists deeds from D1. Requires a bearer session token and supports optional `status` (`pending`, `verified`, `all`) and `user_id` filters. |
| `POST` | `/api/deeds` | Accepts deed submissions with proof metadata, persists them, and returns the created deed entry. |
| `POST` | `/api/verify` | Marks an existing deed as verified, awarding credits and updating the submission status. Requires admin role. |
| `GET` | `/api/deed_catalog` | Returns the list of predefined deed templates from the deed_catalog table. |
| `GET` | `/api/leaderboard` | Returns the top verified neighbors along with their credit totals for the leaderboard view. |
| `GET` | `/api/profile` | Returns profile information for a specific user by `user_id` query parameter. |

> **Authorization:** Supply an `Authorization: Bearer <token>` header obtained from `/api/auth/login` or `/api/auth/signup` when calling `/api/deeds`. Non-admin users are limited to their own `user_id`, while administrators can query the broader dataset.

> **Admin Route Protection:** Admin pages under `/admin/*` are protected server-side. The worker verifies the `deeds_session` cookie contains a valid admin token before serving these pages. Non-admins are redirected to the login page.

## Frontend pages

| Path | Purpose |
| ---- | ------- |
| `public/index.html` | Welcome page that introduces the initiative and links visitors into the onboarding flow. |
| `public/login.html` | Email/password login form that uses the Worker API to authenticate a stored profile. |
| `public/signup.html` | Registration form for new users to create an account. |
| `public/dashboard.html` | Post-login overview showing profile details, recent deed activity, and shortcuts into the deed flow. |
| `public/choose.html` | Guided selection screen for picking a deed template before submitting proof. |
| `public/submit.html` | Submission form that captures proof details and posts them to `/api/deeds`. |
| `public/admin/dashboard.html` | Admin dashboard for managing deeds and users (requires admin role). |
| `public/admin/verify.html` | Verification interface used by administrators to confirm deeds via `/api/verify` (requires admin role). |
| `public/leaderboard.html` | Public leaderboard displaying the top verified neighbors using data from `/api/leaderboard`. |
| `public/profile.html` | Profile summary page that surfaces stored account information from local cache. |

## Contributing
Please open an issue or pull request on GitHub if you encounter bugs or have improvements to share.
