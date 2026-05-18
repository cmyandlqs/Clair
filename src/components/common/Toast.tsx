import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { useToastStore } from '@/hooks/useToast'

type ToastType = 'success' | 'error' | 'warning' | 'info'

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: AlertCircle,
}

const colors: Record<ToastType, string> = {
  success: 'bg-[var(--success)]',
  error: 'bg-[var(--error)]',
  warning: 'bg-[var(--warning)]',
  info: 'bg-[var(--primary)]',
}

export function Toast() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type]

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)]"
            >
              <div
                className={`w-8 h-8 rounded-full ${colors[toast.type]}/10 flex items-center justify-center`}
              >
                <Icon className={`w-4 h-4 ${colors[toast.type]}`} />
              </div>
              <p className="flex-1 text-sm">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}