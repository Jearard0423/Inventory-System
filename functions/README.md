Firebase Cloud Functions for scheduled order notifications

Setup
1. Install deps inside `functions/`:

```bash
cd functions
npm install
```

2. Configure SendGrid and optional settings:

- `SENDGRID_API_KEY` environment variable (or set via `firebase functions:config:set sendgrid.key="API_KEY"`)
- `SENDGRID_FROM` (from email address)
- `SENDGRID_FALLBACK_TO` (optional fallback recipient if no admin users found)
- `BUSINESS_LOGO_URL` (publicly reachable URL to the logo, e.g., hosted in `public/` on your app)

Example using Firebase CLI:

```bash
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_KEY" sendgrid.from="you@yourdomain.com" app.logo="https://example.com/logo.png"
firebase deploy --only functions:scheduledOrderNotifier
```

Notes
- This function reads orders at `inventories/orders` in the Realtime Database and users at `users`.
- It records notifications flags under `inventories/orders/{orderId}/notifications` to avoid duplicate emails.
- You must enable Cloud Scheduler / billing for scheduled functions to run on production.
