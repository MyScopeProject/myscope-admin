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
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/logs"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View All
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => fetchLogs()}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Activity List */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ShieldIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          logs.map((log) => {
            const ActionIcon = getActionIcon(log.resourceType);
            const StatusIcon = STATUS_ICONS[log.status];

            return (
              <div
                key={log._id}
                className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
              >
                {/* Action Icon */}
                <div className="shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    log.status === 'success' ? 'bg-green-100' :
                    log.status === 'error' ? 'bg-red-100' :
                    log.status === 'warning' ? 'bg-yellow-100' :
                    'bg-blue-100'
                  }`}>
                    <ActionIcon className={`w-5 h-5 ${STATUS_COLORS[log.status]}`} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Description */}
                  <p className="text-sm text-gray-900 line-clamp-2">
                    <span className="font-medium">{log.admin?.username || 'Admin'}</span>{' '}
                    {log.description}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Time */}
                    <span className="text-xs text-gray-500">
                      {getTimeAgo(log.createdAt)}
                    </span>

                    {/* Resource Type */}
                    {log.resourceType && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-600 capitalize">
                          {log.resourceType}
                        </span>
                      </>
                    )}

                    {/* Severity Badge */}
                    {log.severity !== 'low' && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[log.severity]}`}>
                          {log.severity}
                        </span>
                      </>
                    )}

                    {/* Metadata */}
                    {log.metadata?.duration && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {log.metadata.duration}ms
                        </span>
                      </>
                    )}

                    {log.metadata?.affectedRecords && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {log.metadata.affectedRecords} affected
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Icon */}
                <div className="shrink-0">
                  <StatusIcon className={`w-5 h-5 ${STATUS_COLORS[log.status]}`} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer - Show more link if there are logs */}
      {logs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <Link
            href="/logs"
            className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View all activity logs →
          </Link>
        </div>
      )}
    </div>
  );
}
