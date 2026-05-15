'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/apiEndpoints';
import { formatDistanceToNow } from 'date-fns';
import {
  UserIcon,
  MusicIcon,
  CalendarIcon,
  TvIcon,
  MessageSquareIcon,
  SettingsIcon,
  ShieldIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  ArrowRightIcon,
  RefreshCwIcon,
} from 'lucide-react';
import Link from 'next/link';

interface AdminLog {
  _id: string;
  admin: {
    _id: string;
    username: string;
    email: string;
  };
  action: string;
  resourceType?: string;
  resourceId?: string;
  description: string;
  status: 'success' | 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  metadata?: {
    duration?: number;
    affectedUsers?: number;
    affectedRecords?: number;
  };
}

const ACTION_ICONS: Record<string, any> = {
  user: UserIcon,
  music: MusicIcon,
  event: CalendarIcon,
  show: TvIcon,
  community: MessageSquareIcon,
  settings: SettingsIcon,
  default: ShieldIcon,
};

const STATUS_ICONS = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

const STATUS_COLORS = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

const SEVERITY_COLORS = {
  low: { bg: "rgba(167, 139, 250, 0.1)", text: "#A78BFA" },
  medium: { bg: "rgba(183, 148, 246, 0.1)", text: "#B794F6" },
  high: { bg: "rgba(216, 199, 254, 0.1)", text: "#D8C7FE" },
  critical: { bg: "rgba(255, 107, 107, 0.1)", text: "#FF6B6B" },
};

export default function RecentActivity() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await adminAPI.getLogs({ limit: 15 });
      setLogs(response.data.logs || []);
    } catch (err: any) {
      console.error('Error fetching activity logs:', err);
      setError(err.response?.data?.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchLogs(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const getActionIcon = (resourceType?: string) => {
    const IconComponent = resourceType ? ACTION_ICONS[resourceType] || ACTION_ICONS.default : ACTION_ICONS.default;
    return IconComponent;
  };

  const getTimeAgo = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  if (loading && !isRefreshing) {
    return (
      <div className="rounded-lg p-6" style={{
        background: "#15121D",
        border: "1px solid rgba(196, 181, 253, 0.10)"
      }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#F5F3FA" }}>Recent Activity</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-10 h-10 rounded-full" style={{ background: "#3F3A4E" }}></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded" style={{ background: "#3F3A4E", width: "75%" }}></div>
                <div className="h-3 rounded" style={{ background: "#3F3A4E", width: "50%" }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-6" style={{
      background: "#15121D",
      border: "1px solid rgba(196, 181, 253, 0.10)"
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "#F5F3FA" }}>Recent Activity</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
            className="p-2 rounded-lg transition-colors disabled:opacity-50"
            style={{
              color: "#9B95B5",
              background: "rgba(167, 139, 250, 0.08)"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(167, 139, 250, 0.12)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(167, 139, 250, 0.08)"}
            title="Refresh"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/logs"
            className="flex items-center gap-1 text-sm font-medium"
            style={{ color: "#B794F6" }}
          >
            View All
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg p-4 mb-4" style={{
          background: "rgba(255, 107, 107, 0.1)",
          border: "1px solid rgba(255, 107, 107, 0.2)"
        }}>
          <p className="text-sm" style={{ color: "#FF6B6B" }}>{error}</p>
          <button
            onClick={() => fetchLogs()}
            className="mt-2 text-sm underline hover:no-underline"
            style={{ color: "#FF6B6B" }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Activity List */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="text-center py-8" style={{ color: "#9B95B5" }}>
            <ShieldIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          logs.map((log) => {
            const ActionIcon = getActionIcon(log.resourceType);
            const StatusIcon = STATUS_ICONS[log.status];

            const statusBgColor = {
              success: "rgba(74, 222, 128, 0.1)",
              error: "rgba(255, 107, 107, 0.1)",
              warning: "rgba(250, 204, 21, 0.1)",
              info: "rgba(167, 139, 250, 0.1)"
            }[log.status];

            const statusIconColor = {
              success: "#4ADE80",
              error: "#FF6B6B",
              warning: "#FACC15",
              info: "#A78BFA"
            }[log.status];

            return (
              <div
                key={log._id}
                className="flex gap-3 p-3 rounded-lg transition-colors"
                style={{
                  border: "1px solid rgba(196, 181, 253, 0.10)",
                  background: "rgba(167, 139, 250, 0.02)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(167, 139, 250, 0.05)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(167, 139, 250, 0.02)"}
              >
                {/* Action Icon */}
                <div className="shrink-0">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: statusBgColor }}
                  >
                    <ActionIcon className="w-5 h-5" style={{ color: statusIconColor }} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Description */}
                  <p className="text-sm line-clamp-2" style={{ color: "#F5F3FA" }}>
                    <span className="font-medium">{log.admin?.username || 'Admin'}</span>{' '}
                    {log.description}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Time */}
                    <span className="text-xs" style={{ color: "#9B95B5" }}>
                      {getTimeAgo(log.createdAt)}
                    </span>

                    {/* Resource Type */}
                    {log.resourceType && (
                      <>
                        <span className="text-xs" style={{ color: "#7A7585" }}>•</span>
                        <span className="text-xs capitalize" style={{ color: "#9B95B5" }}>
                          {log.resourceType}
                        </span>
                      </>
                    )}

                    {/* Severity Badge */}
                    {log.severity !== 'low' && (
                      <>
                        <span className="text-xs" style={{ color: "#7A7585" }}>•</span>
                        <span 
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ 
                            background: SEVERITY_COLORS[log.severity].bg,
                            color: SEVERITY_COLORS[log.severity].text
                          }}
                        >
                          {log.severity}
                        </span>
                      </>
                    )}

                    {/* Metadata */}
                    {log.metadata?.duration && (
                      <>
                        <span className="text-xs" style={{ color: "#7A7585" }}>•</span>
                        <span className="text-xs" style={{ color: "#9B95B5" }}>
                          {log.metadata.duration}ms
                        </span>
                      </>
                    )}

                    {log.metadata?.affectedRecords && (
                      <>
                        <span className="text-xs" style={{ color: "#7A7585" }}>•</span>
                        <span className="text-xs" style={{ color: "#9B95B5" }}>
                          {log.metadata.affectedRecords} affected
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Icon */}
                <div className="shrink-0">
                  <StatusIcon className="w-5 h-5" style={{ color: statusIconColor }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer - Show more link if there are logs */}
      {logs.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(196, 181, 253, 0.10)" }}>
          <Link
            href="/logs"
            className="block text-center text-sm font-medium"
            style={{ color: "#B794F6" }}
          >
            View all activity logs →
          </Link>
        </div>
      )}
    </div>
  );
}
