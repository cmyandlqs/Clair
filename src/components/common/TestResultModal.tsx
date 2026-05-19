import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, XCircle, Copy } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { TestProfileResult } from '@/lib/types'

interface TestResultModalProps {
  result: TestProfileResult
  onClose: () => void
}

export function TestResultModal({ result, onClose }: TestResultModalProps) {
  const { t } = useI18n()

  const copyFullResult = () => {
    const lines = [
      `${result.ok ? '✓' : '✗'} ${result.message}`,
      `Provider: ${result.providerName}`,
      `Model: ${result.expectedModel}`,
      `Route: ${result.localUrl}`,
      `Latency: ${result.latencyMs ?? '?'}ms`,
      `Status: ${result.statusCode ?? 'N/A'}`,
    ]
    if (result.evidence) {
      lines.push(`Model mapping: ${result.evidence.originalModel ?? '(none)'} → ${result.evidence.rewrittenModel ?? '(none)'}`)
      if (result.evidence.upstreamUrl) lines.push(`Upstream: ${result.evidence.upstreamUrl}`)
      if (result.evidence.error) lines.push(`Error: ${result.evidence.error}`)
    }
    navigator.clipboard.writeText(lines.join('\n'))
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="bg-[var(--surface)] rounded-xl shadow-xl border border-[var(--border)] w-[420px] max-h-[80vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              {result.ok ? (
                <CheckCircle className="w-5 h-5 text-[var(--success)]" />
              ) : (
                <XCircle className="w-5 h-5 text-[var(--error)]" />
              )}
              <h3 className="font-semibold text-sm">
                {result.ok ? t('testResult.success') : t('testResult.failed')}
              </h3>
            </div>
            <button onClick={onClose} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
              <span className="text-[var(--text-muted)] text-right">{t('testResult.provider')}</span>
              <span className="font-medium">{result.providerName}</span>

              <span className="text-[var(--text-muted)] text-right">{t('testResult.model')}</span>
              <span className="font-mono text-xs">{result.expectedModel}</span>

              <span className="text-[var(--text-muted)] text-right">{t('testResult.route')}</span>
              <span className="font-mono text-xs break-all">{result.localUrl}</span>

              <span className="text-[var(--text-muted)] text-right">{t('testResult.latency')}</span>
              <span>{result.latencyMs ?? '?'}ms</span>

              <span className="text-[var(--text-muted)] text-right">{t('testResult.statusCode')}</span>
              <span>{result.statusCode ?? 'N/A'}</span>
            </div>

            {result.evidence && (
              <>
                <div className="border-t border-[var(--border)] pt-3">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    {t('testResult.modelMapping')}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <code className="font-mono bg-[var(--surface-muted)] px-2 py-0.5 rounded">
                      {result.evidence.originalModel ?? '(none)'}
                    </code>
                    <span className="text-[var(--text-muted)]">→</span>
                    <code className="font-mono bg-[var(--surface-muted)] px-2 py-0.5 rounded">
                      {result.evidence.rewrittenModel ?? '(none)'}
                    </code>
                  </div>
                </div>
                {result.evidence.upstreamUrl && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">{t('testResult.upstream')}</p>
                    <p className="font-mono text-xs break-all text-[var(--text-secondary)]">{result.evidence.upstreamUrl}</p>
                  </div>
                )}
                {result.evidence.error && (
                  <div className="rounded-lg bg-[var(--error)]/10 p-3 text-xs text-[var(--error)] break-all">
                    {result.evidence.error}
                  </div>
                )}
              </>
            )}

            {!result.ok && result.message && (
              <div className="rounded-lg bg-[var(--error)]/10 p-3 text-xs text-[var(--error)] break-all">
                {result.message}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--border)]">
            <button
              onClick={copyFullResult}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <Copy className="w-3 h-3" />
              {t('testResult.copyResult')}
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="btn-secondary text-xs px-4 py-1.5"
            >
              {t('testResult.close')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
