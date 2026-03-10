import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppLayout } from "@/components/app-layout"
import AuthProvider from "@/components/AuthProvider"
import { FirebaseSyncInitializer } from "@/components/firebase-sync-initializer"
import { ReminderPoller } from "@/components/reminder-poller"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Yellowbell Roast Co. - POS System",
  description: "Modern POS system for Yellowbell Roast Co.",
  generator: "v0.app",
  icons: {
    icon: "/yrc-logo.png",
    apple: "/yrc-logo.png",
  },
  // Prevent in-app browsers (Messenger, etc.) from caching stale versions
  other: {
    "cache-control": "no-cache, no-store, must-revalidate",
    "pragma": "no-cache",
    "expires": "0",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Force no-cache for in-app browsers (Messenger, Facebook, etc.) */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <FirebaseSyncInitializer />
          <ReminderPoller />
          <AppLayout>
            {children}
          </AppLayout>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}