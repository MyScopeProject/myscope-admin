"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { useAuth } from "@/contexts/auth-context"
import { adminAPI } from "@/lib/apiEndpoints"
import { Users, Calendar, DollarSign, TrendingUp, type LucideIcon } from "lucide-react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import RecentActivity from "@/components/dashboard/RecentActivity"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface OverviewData {
  stats: {
    totalUsers: number
    totalEvents: number
    totalSales: number
  }
  weeklyGrowth: Array<{
    day: string
    users: number
    newUsers: number
  }>
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOverviewData()
  }, [])

  const fetchOverviewData = async () => {
    try {
      const response = await adminAPI.getOverview()
      setOverviewData(response.data.data)
    } catch (error: any) {
      console.error('Error fetching overview:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout user={user || undefined}>
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        <div className="space-y-8">
          {/* Page header */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ''} 👋
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Overview
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Users"
              value={overviewData?.stats.totalUsers.toLocaleString() ?? "0"}
              icon={Users}
              accent="primary"
              delay={0}
            />
            <StatCard
              title="Total Events"
              value={overviewData?.stats.totalEvents.toLocaleString() ?? "0"}
              icon={Calendar}
              accent="emerald"
              delay={0.05}
            />
            <StatCard
              title="Total Sales"
              value={`LKR ${(overviewData?.stats.totalSales ?? 0).toLocaleString()}`}
              icon={DollarSign}
              accent="amber"
              delay={0.1}
            />
          </div>

          {/* Weekly user growth chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Weekly User Growth</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  New registrations over the past week
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                Live
              </span>
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={overviewData?.weeklyGrowth ?? []}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" style={{ fontSize: 12 }} />
                <YAxis stroke="var(--muted-foreground)" style={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--popover-foreground)",
                  }}
                  labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                  name="Total Users"
                />
                <Area
                  type="monotone"
                  dataKey="newUsers"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorNewUsers)"
                  name="New Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Recent activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <RecentActivity />
          </motion.div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  delay: number
  accent?: "primary" | "emerald" | "amber"
}

const ACCENTS = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const

function StatCard({ title, value, icon: Icon, delay, accent = "primary" }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACCENTS[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  )
}
