import { Settings, Play, Square } from 'lucide-react'
import { useProxyStatus, useStartProxy, useStopProxy } from '@/hooks/useProxyStatus'
import { useUIStore } from '@/hooks/useUIStore'
import { useI18n } from '@/lib/i18n'
import { useToastStore } from '@/hooks/useToast'

export function TopBar() {
  const { openModal } = useUIStore()
  const { data: status } = useProxyStatus()
  const { addToast } = useToastStore()
  const { t } = useI18n()

  const startProxyMutation = useStartProxy()
  const stopProxyMutation = useStopProxy()

  const isRunning = status?.running
  const isStarting = startProxyMutation.isPending
  const isStopping = stopProxyMutation.isPending

  const handleStart = async () => {
    try {
      await startProxyMutation.mutateAsync()
      addToast('success', t('proxy.running'))
    } catch (error) {
      console.error('[startProxy] error:', error)
      addToast('error', `${t('error.generic')}: ${error}`)
    }
  }

  const handleStop = async () => {
    try {
      await stopProxyMutation.mutateAsync()
      addToast('success', t('proxy.stopped'))
    } catch (error) {
      console.error('[stopProxy] error:', error)
      addToast('error', `${t('error.generic')}: ${error}`)
    }
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {t('app.name')}
        </h1>
        <span className="text-sm text-[var(--text-muted)] hidden sm:inline">
          {t('app.tagline')}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-muted)]">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'
            }`}
          />
          <span className="text-sm font-medium">
            {isStarting ? '...' : isRunning ? t('proxy.running') : t('proxy.stopped')}
          </span>
        </div>

        {isRunning ? (
          <button
            onClick={handleStop}
            disabled={isStopping}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Square className="w-3.5 h-3.5" />
            {isStopping ? '...' : t('proxy.stop')}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Play className="w-3.5 h-3.5" />
            {isStarting ? '...' : t('proxy.start')}
          </button>
        )}

        <button
          onClick={() => openModal('addProvider')}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <span className="text-lg leading-none">+</span>
          {t('provider.add')}
        </button>

        <button
          onClick={() => openModal('settings')}
          className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
        >
          <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
      </div>
    </header>
  )
}
