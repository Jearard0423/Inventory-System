import { database } from "./firebase"
import { ref, onValue, set, update, remove, off } from "firebase/database"

export interface Notification {
  id: string
  type: "order" | "inventory" | "delivery" | "system"
  title: string
  message: string
  timestamp: string
  read: boolean
  priority: "low" | "medium" | "high"
  data?: any
}

const NOTIF_LOCAL_KEY = "yellowbell_notifications"
const FIREBASE_PATH = "notifications"

// ── Local helpers ─────────────────────────────────────────────────────────────

export const getNotifications = (): Notification[] => {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(NOTIF_LOCAL_KEY)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

const saveLocal = (notifications: Notification[]) => {
  if (typeof window === "undefined") return
  const trimmed = notifications.slice(0, 100)
  localStorage.setItem(NOTIF_LOCAL_KEY, JSON.stringify(trimmed))
  window.dispatchEvent(new Event("notifications-updated"))
}

// ── Firebase sync ─────────────────────────────────────────────────────────────

const pushNotifToFirebase = async (notif: Notification) => {
  try {
    const { data: _data, ...firebaseSafe } = notif
    await set(ref(database, `${FIREBASE_PATH}/${notif.id}`), firebaseSafe)
  } catch { /* non-critical */ }
}

const patchNotifInFirebase = async (notifId: string, patch: Partial<Notification>) => {
  try {
    await update(ref(database, `${FIREBASE_PATH}/${notifId}`), patch)
  } catch { /* non-critical */ }
}

const removeNotifFromFirebase = async (notifId: string) => {
  try {
    await remove(ref(database, `${FIREBASE_PATH}/${notifId}`))
  } catch { /* non-critical */ }
}

// ── Real-time listener ────────────────────────────────────────────────────────
// Keeps all admins in sync — new notifications from any admin appear instantly.

let _listenerActive = false

export const startNotificationsListener = () => {
  if (typeof window === "undefined" || _listenerActive) return
  _listenerActive = true

  onValue(ref(database, FIREBASE_PATH), (snap) => {
    try {
      if (!snap.exists()) return
      const remote: Notification[] = Object.values(snap.val())
      remote.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      // Keep local read state if already read
      const localMap = new Map(getNotifications().map(n => [n.id, n]))
      const merged = remote.map(r => localMap.get(r.id)?.read ? { ...r, read: true } : r)
      saveLocal(merged)
    } catch { /* ignore */ }
  })
}

export const stopNotificationsListener = () => {
  if (typeof window === "undefined") return
  off(ref(database, FIREBASE_PATH))
  _listenerActive = false
}

// ── Public API ────────────────────────────────────────────────────────────────

export const saveNotification = (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
  if (typeof window === "undefined") return

  const newNotification: Notification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    read: false,
  }

  const notifications = getNotifications()
  notifications.unshift(newNotification)
  saveLocal(notifications)
  pushNotifToFirebase(newNotification)
}

export const markAsRead = (notificationId: string) => {
  if (typeof window === "undefined") return
  const updated = getNotifications().map((n) => n.id === notificationId ? { ...n, read: true } : n)
  saveLocal(updated)
  patchNotifInFirebase(notificationId, { read: true })
}

export const markAllAsRead = () => {
  if (typeof window === "undefined") return
  const updated = getNotifications().map((n) => ({ ...n, read: true }))
  saveLocal(updated)
  updated.forEach(n => patchNotifInFirebase(n.id, { read: true }))
}

export const deleteNotification = (notificationId: string) => {
  if (typeof window === "undefined") return
  const updated = getNotifications().filter((n) => n.id !== notificationId)
  saveLocal(updated)
  removeNotifFromFirebase(notificationId)
}

export const getUnreadCount = (): number => {
  return getNotifications().filter((n) => !n.read).length
}