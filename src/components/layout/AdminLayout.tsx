"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRoute } from "@/lib/rbac"
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarCheck,
  Film,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  Building2,
  Banknote,
  BarChart3,
} from "lucide-react"
import { ThemeToggle } from "../ui/theme-toggle"

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
}

const allNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/users", icon: Users },
  { name: "Organizers", href: "/organizers", icon: Building2 },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Event Review", href: "/events/review", icon: CalendarCheck },
  { name: "Movies", href: "/movies", icon: Film },
  { name: "Payouts", href: "/payouts", icon: Banknote },
  { name: "Finance Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
]

interface AdminLayoutProps {
  children: React.ReactNode
  user?: {
    name: string
    email: string
    role: string
    profileImage?: string
  }
}

export function AdminLayout({ children, user }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const pathname = usePathname()
  const { logout } = useAuth()

  // Filter navigation items based on user's role
  const navItems = React.useMemo(() => {
    if (!user?.role) return []
    
    return allNavItems.filter(item => {
      // Dashboard is accessible to all admin roles
      if (item.href === '/dashboard') return true
      
      // Check if user can access this route
      return canAccessRoute(user.role, item.href)
    })
  }, [user?.role])

  const handleLogout = () => {
    logout()
  }

  // The active nav item is the longest-prefix match against the current pathname.
  // Without this, sibling items like /events and /events/review both light up on /events/review.
  const activeHref = React.useMemo(() => {
    if (!pathname) return null
    let best: string | null = null
    for (const item of navItems) {
      const match = pathname === item.href || pathname.startsWith(`${item.href}/`)
      if (match && (best === null || item.href.length > best.length)) {
        best = item.href
      }
    }
    return best
  }, [navItems, pathname])

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full bg-card border-r border-border transition-all duration-300 ${
          sidebarCollapsed ? "w-16" : "w-64"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="flex h-20 items-center justify-between border-b border-border px-3">
          {sidebarCollapsed ? (
            <Link href="/dashboard" className="mx-auto flex items-center">
              <Image
                src="/images/logo.png"
                alt="MyScope"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />
            </Link>
          ) : (
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/images/navbar_logo.png"
                alt="MyScope"
                width={220}
                height={64}
                className="h-16 w-auto object-contain"
                priority
              />
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={`h-5 w-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto h-[calc(100vh-4rem)]">
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Manage
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href === activeHref

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                {!sidebarCollapsed && <span>{item.name}</span>}
                {!sidebarCollapsed && isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        }`}
      >
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Admin Panel
              </p>
              <h1 className="text-base font-semibold text-foreground -mt-0.5">
                {navItems.find((n) => n.href === activeHref)?.name ?? "Dashboard"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {user && (
              <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-border bg-card pl-3 pr-1 py-1">
                <div className="text-right leading-tight">
                  <p className="text-xs font-semibold text-foreground">{user.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{user.role}</p>
                </div>
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/20">
                  {user.profileImage ? (
                    <Image
                      src={user.profileImage}
                      alt={user.name}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary font-semibold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
