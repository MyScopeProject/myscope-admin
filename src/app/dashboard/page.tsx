"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { useAuth } from "@/contexts/auth-context"
import { adminAPI } from "@/lib/apiEndpoints"
import { Users, Calendar, Music, DollarSign, LogOut } from "lucide-react"
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
  ResponsiveContainer 
} from "recharts"

interface OverviewData {
  stats: {
    totalUsers: number
    totalEvents: number
    totalMusic: number
    totalSales: number
  }
  weeklyGrowth: Array<{
    day: string
    users: number
    newUsers: number
  }>
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
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

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    router.push('/login')
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout user={user || undefined}>
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Top Navigation Bar */}
          <div className="bg-card rounded-lg border border-border p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">M</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">MyScope Admin</h1>
                  <p className="text-xs text-muted-foreground">Dashboard Overview</p>
                </div>
              </div>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Page Header */}
          <div>
            <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user?.name}! Here's your overview.
            </p>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Users"
              value={overviewData?.stats.totalUsers.toLocaleString() || "0"}
              icon={Users}
              iconColor="bg-blue-500"
              delay={0}
            />
            <StatCard
              title="Total Events"
              value={overviewData?.stats.totalEvents.toLocaleString() || "0"}
              icon={Calendar}
              iconColor="bg-purple-500"
              delay={0.1}
            />
            <StatCard
              title="Total Music"
              value={overviewData?.stats.totalMusic.toLocaleString() || "0"}
              icon={Music}
              iconColor="bg-emerald-500"
              delay={0.2}
            />
            <StatCard
              title="Total Sales"
              value={`$${overviewData?.stats.totalSales.toLocaleString() || "0"}`}
              icon={DollarSign}
              iconColor="bg-green-500"
              delay={0.3}
            />
          </div>

          {/* Weekly User Growth Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-card rounded-lg border border-border p-6"
          >
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground">Weekly User Growth</h3>
              <p className="text-sm text-muted-foreground mt-1">
                New user registrations over the past week
              </p>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={overviewData?.weeklyGrowth || []}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="day" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorUsers)"
                  name="Total Users"
                />
                <Area 
                  type="monotone" 
                  dataKey="newUsers" 
                  stroke="#6366F1" 
                  strokeWidth={2}
                  fillOpacity={0.2} 
                  fill="#6366F1"
                  name="New Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Recent Activity Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
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
  icon: React.ElementType
  iconColor: string
  delay: number
}

function StatCard({ title, value, icon: Icon, iconColor, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ 
        scale: 1.05,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      }}
      className="bg-card rounded-lg border border-border p-6 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`h-12 w-12 rounded-lg ${iconColor} bg-opacity-10 flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${iconColor.replace('bg-', 'text-')}`} />
        </div>
      </div>
      <h3 className="text-3xl font-bold text-foreground mb-1">{value}</h3>
      <p className="text-sm text-muted-foreground">{title}</p>
    </motion.div>
  )
}
