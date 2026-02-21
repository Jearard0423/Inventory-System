import nodemailer from "nodemailer";
import { smtpConfig } from "../config/smtp.config";

let transporter: nodemailer.Transporter | null = null;

function initTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  const mailer = initTransporter();
  if (!mailer) {
    console.log("[emailService] transporter not configured, logging message");
    console.log({ to, subject, text, html });
    return;
  }

  await mailer.sendMail({
    from: smtpConfig.from,
    to,
    subject,
    text,
    html,
  });
}
