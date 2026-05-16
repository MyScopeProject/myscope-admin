"use client"

import { GoogleOAuthProvider } from "@react-oauth/google"

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  // When the env var is missing we still render children so the rest of the
  // app works — the Google button will just no-op and the user can fall back
  // to email/password.
  if (!clientId) return <>{children}</>
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>
}
