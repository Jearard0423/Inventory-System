export interface Order {
  id: string;
  customer: string;
  items: string[];
  deadline: Date;
  status: "pending" | "done";
  notified1hr: boolean;
  notified30min: boolean;
  createdAt: Date;
}

export type NewOrder = Pick<Order, "id" | "customer" | "items" | "deadline">;