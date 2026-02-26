# Yellow Roast Co. Inventory System

_This README contains setup and deployment notes specific to email notifications and environment configuration._

## Environment Variables

The application reads critical settings from environment variables at runtime. For local development, create a file named `.env.local` at the project root (this file is already ignored by git) with the following values:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yellowroastco2024@gmail.com
SMTP_PASSWORD=<your-16-char-gmail-app-password>
```

Once added, restart the dev server (`npm run dev`) and emails will be sent automatically using the specified account. You will never need to type credentials manually again.

When deploying to a hosting platform (Vercel, Netlify, Docker, etc.), set the *same* four variables in the environment settings of that platform. The code will read `process.env.SMTP_*` exactly the same way whether running locally or in production.

> **Note:** the client keeps a short‑lived history of which orders have already triggered emails in `localStorage` under the key `yellowbell_notified_orders`. If you clear storage (e.g. during testing) the system may re‑send grouped notifications for recent orders.
>
> Emails can be grouped into one message when multiple orders are placed within the same minute **or** when they share a delivery/cook time within 30 minutes of each other; the grouped notification displays a simple table showing customer, order items, time, and date. Cancelled orders are also logged and shown in the *Notifications* dashboard with a “View details” link.

## Deployment Notes

- The `.env.local` file is **not** committed; secrets stay private.  
- On your production server, configure environment variables through your provider's dashboard or CLI.  
- The notification system will automatically use the logged‑in admin's email address as the recipient, and the sender will always be the address stored in `SMTP_USER`.

---
