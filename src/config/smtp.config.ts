export const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASSWORD || "",
  from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@yellowbell.com",
  defaultRecipient: process.env.ADMIN_EMAIL || "admin@yellowbell.com",
};