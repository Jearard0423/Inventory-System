import { Order, NewOrder } from "../types/order.types";
import { sendEmail } from "./emailService";
import { smtpConfig } from "../config/smtp.config";

// In-memory store for the example
const orders: Order[] = [];

export function createOrder(newOrder: NewOrder) {
  const order: Order = {
    ...newOrder,
    status: "pending",
    notified1hr: false,
    notified30min: false,
    createdAt: new Date(),
  };
  orders.push(order);
  notifyOrderPlaced(order);
  return order;
}

function notifyOrderPlaced(order: Order) {
  const to = smtpConfig.defaultRecipient; // fallback
  const subject = `New order from ${order.customer}`;
  const html = `<p>Customer ${order.customer} ordered ${order.items.join(", ")}.</p>`;
  sendEmail(to, subject, html);
}

export function getOrders() {
  return orders;
}

export function markDone(id: string) {
  const o = orders.find(o => o.id === id);
  if (o) o.status = "done";
}
