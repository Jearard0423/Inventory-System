import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppLayout } from "@/components/app-layout"
import AuthProvider from "@/components/AuthProvider"
import { FirebaseSyncInitializer } from "@/components/firebase-sync-initializer"
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <FirebaseSyncInitializer />
        <AuthProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
