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
  RefreshCwIcon,
  type LucideIcon,
} from 'lucide-react';

interface AdminLog {
  id: string;
  admin_id?: string;
  admin?: {
    id: string;
    name?: string;
    username?: string;
    email: string;
  };
  action: string;
  resource_type?: string;
  resource_id?: string;
  description: string;
  status: 'success' | 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  metadata?: {
    duration?: number;
    affectedUsers?: number;
    affectedRecords?: number;
  };
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  user: UserIcon,
  music: MusicIcon,
  event: CalendarIcon,
  show: TvIcon,
  community: MessageSquareIcon,
  settings: SettingsIcon,
  default: ShieldIcon,
};

const STATUS_ICONS: Record<AdminLog['status'], LucideIcon> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

// Status -> Tailwind utility classes (token-driven, work in both themes).
const STATUS_TONE: Record<AdminLog['status'], { bg: string; text: string }> = {
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  error: { bg: 'bg-destructive/10', text: 'text-destructive' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  info: { bg: 'bg-primary/10', text: 'text-primary' },
};

const SEVERITY_TONE: Record<AdminLog['severity'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  critical: 'bg-destructive/15 text-destructive',
};

export default function RecentActivity() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setLoading(true);
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
    const interval = setInterval(() => fetchLogs(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const getActionIcon = (resourceType?: string): LucideIcon =>
    (resourceType && ACTION_ICONS[resourceType]) || ACTION_ICONS.default;

  const getTimeAgo = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  if (loading && !isRefreshing) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded bg-muted w-3/4" />
                <div className="h-3 rounded bg-muted w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <button
          type="button"
          onClick={() => fetchLogs(true)}
          disabled={isRefreshing}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh activity"
        >
          <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="rounded-md p-4 mb-4 bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => fetchLogs()}
            className="mt-2 text-sm text-destructive underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <ShieldIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          logs.map((log) => {
            const ActionIcon = getActionIcon(log.resource_type);
            const StatusIcon = STATUS_ICONS[log.status] ?? InfoIcon;
            const tone = STATUS_TONE[log.status] ?? STATUS_TONE.info;
            const severityClass =
              SEVERITY_TONE[log.severity as AdminLog['severity']] ?? SEVERITY_TONE.low;

            return (
              <div
                key={log.id}
                className="flex gap-3 p-3 rounded-md border border-transparent hover:border-border hover:bg-accent/50 transition-colors"
              >
                {/* Action icon */}
                <div className="shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tone.bg}`}>
                    <ActionIcon className={`w-5 h-5 ${tone.text}`} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">
                    <span className="font-medium">
                      {log.admin?.name || log.admin?.username || 'Admin'}
                    </span>{' '}
                    {log.description}
                  </p>

                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                    <span>{getTimeAgo(log.created_at)}</span>

                    {log.resource_type && (
                      <>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="capitalize">{log.resource_type}</span>
                      </>
                    )}

                    {log.severity && log.severity !== 'low' && (
                      <>
                        <span className="text-muted-foreground/60">•</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${severityClass}`}>
                          {log.severity}
                        </span>
                      </>
                    )}

                    {log.metadata?.duration && (
                      <>
                        <span className="text-muted-foreground/60">•</span>
                        <span>{log.metadata.duration}ms</span>
                      </>
                    )}

                    {log.metadata?.affectedRecords && (
                      <>
                        <span className="text-muted-foreground/60">•</span>
                        <span>{log.metadata.affectedRecords} affected</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status icon */}
                <div className="shrink-0">
                  <StatusIcon className={`w-5 h-5 ${tone.text}`} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
