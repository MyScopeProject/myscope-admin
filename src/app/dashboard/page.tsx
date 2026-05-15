"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { useAuth } from "@/contexts/auth-context"
import { adminAPI } from "@/lib/apiEndpoints"
import { Users, Calendar, DollarSign, LogOut } from "lucide-react"
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
          <div className="rounded-lg p-4 flex items-center justify-between" style={{
            background: "#15121D",
            border: "1px solid rgba(196, 181, 253, 0.10)"
          }}>
            <div className="flex items-center space-x-4">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#A78BFA] to-[#B794F6] flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold" style={{ color: "#F5F3FA" }}>MyScope Admin</h1>
                  <p className="text-xs" style={{ color: "#9B95B5" }}>Dashboard Overview</p>
                </div>
              </div>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="sm font-medium" style={{ color: "#F5F3FA" }}>{user?.name}</p>
                <p className="text-xs capitalize" style={{ color: "#9B95B5" }}>{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  background: "rgba(255, 107, 107, 0.1)",
                  color: "#FF6B6B"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 107, 107, 0.2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 107, 107, 0.1)"}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Page Header */}
          <div>
            <h2 className="text-3xl font-bold" style={{ color: "#F5F3FA" }}>Dashboard</h2>
            <p className="mt-1" style={{ color: "#9B95B5" }}>
              Welcome back, {user?.name}! Here's your overview.
            </p>
          </div>

          {/* 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Users"
              value={overviewData?.stats.totalUsers.toLocaleString() || "0"}
              icon={Users}
              color="#A78BFA"
              delay={0}
            />
            <StatCard
              title="Total Events"
              value={overviewData?.stats.totalEvents.toLocaleString() || "0"}
              icon={Calendar}
              color="#B794F6"
              delay={0.1}
            />
            <StatCard
              title="Total Sales"
              value={`$${overviewData?.stats.totalSales.toLocaleString() || "0"}`}
              icon={DollarSign}
              color="#D8C7FE"
              delay={0.2}
            />
          </div>

          {/* Weekly User Growth Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-card rounded-lg border p-6"
            style={{ borderColor: "rgba(196, 181, 253, 0.10)" }}
          >
            <div className="mb-6">
              <h3 className="text-xl font-semibold" style={{ color: "#F5F3FA" }}>Weekly User Growth</h3>
              <p className="text-sm mt-1" style={{ color: "#9B95B5" }}>
                New user registrations over the past week
              </p>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={overviewData?.weeklyGrowth || []}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B794F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#B794F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(196, 181, 253, 0.10)" />
                <XAxis 
                  dataKey="day" 
                  stroke="#9B95B5"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#9B95B5"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#15121D", 
                    border: "1px solid rgba(196, 181, 253, 0.10)",
                    borderRadius: "0.5rem",
                    boxShadow: "0 8px 24px rgba(167, 139, 250, 0.08)"
                  }}
                  labelStyle={{ color: "#F5F3FA", fontWeight: 600 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#A78BFA" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorUsers)"
                  name="Total Users"
                />
                <Area 
                  type="monotone" 
                  dataKey="newUsers" 
                  stroke="#B794F6" 
                  strokeWidth={2}
                  fillOpacity={0.2} 
                  fill="#B794F6"
                  name="New Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Recent Activity Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
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
  color: string
  delay: number
}

function StatCard({ title, value, icon: Icon, color, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ 
        scale: 1.05,
        boxShadow: "0 20px 25px -5px rgba(167, 139, 250, 0.1)"
      }}
      className="rounded-lg p-6 cursor-pointer"
      style={{
        background: "#15121D",
        border: "1px solid rgba(196, 181, 253, 0.10)"
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div 
          className="h-12 w-12 rounded-lg flex items-center justify-center"
          style={{
            background: `${color}20`,
          }}
        >
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
      </div>
      <h3 className="text-3xl font-bold mb-1" style={{ color: "#F5F3FA" }}>{value}</h3>
      <p style={{ color: "#9B95B5" }} className="text-sm">{title}</p>
    </motion.div>
  )
}
