# Deeds App

The Deeds App is an MVP that helps neighbors document good deeds, verify contributions, and celebrate impact on a shared leaderboard. It is built with a Cloudflare Worker backend and a Tailwind-powered frontend.

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
| `POST` | `/api/auth/signup` | Registers a new neighbor profile, hashes the provided password, stores the record in D1, and returns the persisted profile payload. |
| `POST` | `/api/auth/login` | Authenticates an existing profile by verifying the submitted password, automatically upgrading legacy hashes, and responding with the stored profile. |
| `GET` | `/api/deeds` | Lists deeds from D1. Requires a bearer session token and supports optional `status` (`pending`, `verified`, `all`) and `user_id` filters. |
| `POST` | `/api/deeds` | Accepts deed submissions with proof metadata, persists them, and returns the created deed entry. |
| `POST` | `/api/verify` | Marks an existing deed as verified, awarding credits and updating the submission status. |
| `GET` | `/api/leaderboard` | Returns the top verified neighbors along with their credit totals for the leaderboard view. |

> **Authorization:** Supply an `Authorization: Bearer <token>` header obtained from `/api/auth/login` or `/api/auth/signup` when calling `/api/deeds`. Non-admin users are limited to their own `user_id`, while administrators can query the broader dataset.

## Frontend pages

| Path | Purpose |
| ---- | ------- |
| `public/index.html` | Welcome page that introduces the initiative and links visitors into the onboarding flow. |
| `public/login.html` | Email/password login form that uses the Worker API to authenticate a stored profile. |
| `public/dashboard.html` | Post-login overview showing profile details, recent deed activity, and shortcuts into the deed flow. |
| `public/choose.html` | Guided selection screen for picking a deed template before submitting proof. |
| `public/submit.html` | Submission form that captures proof details and posts them to `/api/deeds`. |
| `public/verify.html` | Verification interface used by administrators to confirm deeds via `/api/verify`. |
| `public/leaderboard.html` | Public leaderboard displaying the top verified neighbors using data from `/api/leaderboard`. |
| `public/profile.html` | Profile summary page that surfaces stored account information from local cache. |

## Contributing
Please open an issue or pull request on GitHub if you encounter bugs or have improvements to share.
