import { AlertCircle, CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react'

interface ErrorMessageProps {
  title?: string
  message: string
  type?: 'error' | 'warning' | 'info' | 'success'
  className?: string
  // Optional callback — renders a "Try again" button below the message.
  // Used by load-on-mount pages (shop-orders, etc.) to retry the fetch.
  onRetry?: () => void | Promise<void>
}

export function ErrorMessage({
  title,
  message,
  type = 'error',
  className = '',
  onRetry,
}: ErrorMessageProps) {
  const styles = {
    error: {
      container: 'bg-destructive/10 border-destructive/50 text-destructive',
      icon: XCircle,
    },
    warning: {
      container: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-600 dark:text-yellow-500',
      icon: AlertCircle,
    },
    info: {
      container: 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-500',
      icon: Info,
    },
    success: {
      container: 'bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-500',
      icon: CheckCircle2,
    },
  }

  const style = styles[type]
  const Icon = style.icon

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${style.container} ${className}`}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <p className="text-sm">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={() => { void onRetry() }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: { 
  icon?: any
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
      {action}
    </div>
  )
}
