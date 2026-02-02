export interface Notification {
  id: string
  type: "order" | "inventory" | "delivery" | "system"
  title: string
  message: string
  timestamp: string
  read: boolean
  priority: "low" | "medium" | "high"
}

export const getNotifications = (): Notification[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem("yellowbell_notifications")
  return stored ? JSON.parse(stored) : []
}

export const saveNotification = (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
  if (typeof window === "undefined") return

  const notifications = getNotifications()
  const newNotification: Notification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    read: false,
  }

  notifications.unshift(newNotification)
  localStorage.setItem("yellowbell_notifications", JSON.stringify(notifications))
  window.dispatchEvent(new Event("notifications-updated"))
}

export const markAsRead = (notificationId: string) => {
  if (typeof window === "undefined") return

  const notifications = getNotifications()
  const updated = notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
  localStorage.setItem("yellowbell_notifications", JSON.stringify(updated))
  window.dispatchEvent(new Event("notifications-updated"))
}

export const markAllAsRead = () => {
  if (typeof window === "undefined") return

  const notifications = getNotifications()
  const updated = notifications.map((n) => ({ ...n, read: true }))
  localStorage.setItem("yellowbell_notifications", JSON.stringify(updated))
  window.dispatchEvent(new Event("notifications-updated"))
}

export const deleteNotification = (notificationId: string) => {
  if (typeof window === "undefined") return

  const notifications = getNotifications()
  const updated = notifications.filter((n) => n.id !== notificationId)
  localStorage.setItem("yellowbell_notifications", JSON.stringify(updated))
  window.dispatchEvent(new Event("notifications-updated"))
}

export const getUnreadCount = (): number => {
  return getNotifications().filter((n) => !n.read).length
}
