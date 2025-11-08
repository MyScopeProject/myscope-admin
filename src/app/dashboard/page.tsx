"use client"

import { AdminLayout } from "@/components/layout/AdminLayout"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { useAuth } from "@/contexts/auth-context"
import { Users, Calendar, Music, Film, DollarSign, MessageSquare, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts"

// Sample data for charts
const userGrowthData = [
  { month: "Jan", users: 400, events: 24, revenue: 2400 },
  { month: "Feb", users: 520, events: 32, revenue: 2800 },
  { month: "Mar", users: 680, events: 38, revenue: 3200 },
  { month: "Apr", users: 850, events: 42, revenue: 3800 },
  { month: "May", users: 980, events: 48, revenue: 4200 },
  { month: "Jun", users: 1100, events: 52, revenue: 4800 },
  { month: "Jul", users: 1234, events: 56, revenue: 5200 },
]

const engagementData = [
  { day: "Mon", plays: 1200, likes: 450, comments: 230 },
  { day: "Tue", plays: 1400, likes: 520, comments: 280 },
  { day: "Wed", plays: 1100, likes: 380, comments: 190 },
  { day: "Thu", plays: 1600, likes: 640, comments: 350 },
  { day: "Fri", plays: 1800, likes: 720, comments: 420 },
  { day: "Sat", plays: 2200, likes: 890, comments: 520 },
  { day: "Sun", plays: 1900, likes: 760, comments: 450 },
]

const contentDistribution = [
  { name: "Music", value: 890, color: "#10B981" },
  { name: "Events", value: 56, color: "#6366F1" },
  { name: "Shows", value: 23, color: "#F472B6" },
  { name: "Posts", value: 342, color: "#8B5CF6" },
]

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.name}! Here's what's happening today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value="1,234"
            icon={Users}
            trend="+12.5%"
            trendUp={true}
            subtitle="vs last month"
          />
          <StatCard
            title="Total Events"
            value="56"
            icon={Calendar}
            trend="+8.2%"
            trendUp={true}
            subtitle="vs last month"
          />
          <StatCard
            title="Total Revenue"
            value="$5,200"
            icon={DollarSign}
            trend="+18.3%"
            trendUp={true}
            subtitle="vs last month"
          />
          <StatCard
            title="Engagement"
            value="2,890"
            icon={TrendingUp}
            trend="-3.1%"
            trendUp={false}
            subtitle="vs last week"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MiniStatCard
            title="Music Tracks"
            value="890"
            icon={Music}
            iconColor="text-emerald-500"
          />
          <MiniStatCard
            title="Shows"
            value="23"
            icon={Film}
            iconColor="text-pink-500"
          />
          <MiniStatCard
            title="Community Posts"
            value="342"
            icon={MessageSquare}
            iconColor="text-indigo-500"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              User Growth & Revenue
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={userGrowthData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem"
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#10B981" 
                  fillOpacity={1} 
                  fill="url(#colorUsers)"
                  name="Users"
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#6366F1" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)"
                  name="Revenue ($)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Engagement Chart */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Weekly Engagement
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem"
                  }}
                />
                <Legend />
                <Bar dataKey="plays" fill="#10B981" name="Plays" radius={[4, 4, 0, 0]} />
                <Bar dataKey="likes" fill="#6366F1" name="Likes" radius={[4, 4, 0, 0]} />
                <Bar dataKey="comments" fill="#F472B6" name="Comments" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content Distribution */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Content Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={contentDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name}: ${(entry.percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {contentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-lg border border-border p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Recent Activity
            </h3>
            <div className="space-y-4">
              <ActivityItem
                action="New user registered"
                user="john@example.com"
                time="5 minutes ago"
                type="user"
              />
              <ActivityItem
                action="Event created"
                user="Sarah (Event Manager)"
                time="1 hour ago"
                type="event"
              />
              <ActivityItem
                action="Music track uploaded"
                user="Mike (Content Manager)"
                time="2 hours ago"
                type="music"
              />
              <ActivityItem
                action="Show published"
                user="Admin"
                time="3 hours ago"
                type="show"
              />
              <ActivityItem
                action="New community post"
                user="Alex Chen"
                time="4 hours ago"
                type="post"
              />
              <ActivityItem
                action="Event ticket sold"
                user="Emma Wilson"
                time="5 hours ago"
                type="revenue"
              />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
    </ProtectedRoute>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ElementType
  trend: string
  trendUp: boolean
  subtitle: string
}

function StatCard({ title, value, icon: Icon, trend, trendUp, subtitle }: StatCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6 hover:border-primary/50 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex items-center space-x-1">
          {trendUp ? (
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          )}
          <span className={`text-sm font-semibold ${trendUp ? "text-green-500" : "text-red-500"}`}>
            {trend}
          </span>
        </div>
      </div>
      <h3 className="text-3xl font-bold text-foreground mb-1">{value}</h3>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}

interface MiniStatCardProps {
  title: string
  value: string
  icon: React.ElementType
  iconColor: string
}

function MiniStatCard({ title, value, icon: Icon, iconColor }: MiniStatCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 flex items-center space-x-4">
      <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h4 className="text-2xl font-bold text-foreground">{value}</h4>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    </div>
  )
}

interface ActivityItemProps {
  action: string
  user: string
  time: string
  type: string
}

function ActivityItem({ action, user, time, type }: ActivityItemProps) {
  const getTypeColor = () => {
    switch (type) {
      case "user": return "bg-blue-500/10 text-blue-500"
      case "event": return "bg-purple-500/10 text-purple-500"
      case "music": return "bg-emerald-500/10 text-emerald-500"
      case "show": return "bg-pink-500/10 text-pink-500"
      case "post": return "bg-indigo-500/10 text-indigo-500"
      case "revenue": return "bg-green-500/10 text-green-500"
      default: return "bg-gray-500/10 text-gray-500"
    }
  }

  const getTypeIcon = () => {
    switch (type) {
      case "user": return <Users className="h-3 w-3" />
      case "event": return <Calendar className="h-3 w-3" />
      case "music": return <Music className="h-3 w-3" />
      case "show": return <Film className="h-3 w-3" />
      case "post": return <MessageSquare className="h-3 w-3" />
      case "revenue": return <DollarSign className="h-3 w-3" />
      default: return null
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center space-x-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${getTypeColor()}`}>
          {getTypeIcon()}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{action}</p>
          <p className="text-xs text-muted-foreground">{user}</p>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  )
}

