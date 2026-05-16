import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { GoogleAuthProvider } from "@/components/providers/google-auth-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MyScope Admin - Dashboard",
  description: "Admin panel for MyScope entertainment platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          defaultTheme="dark"
          storageKey="myscope-admin-theme"
        >
          <GoogleAuthProvider>
            <AuthProvider>
              {children}
              <ToastProvider />
            </AuthProvider>
          </GoogleAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
