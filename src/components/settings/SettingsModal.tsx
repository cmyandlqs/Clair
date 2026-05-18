import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, FolderOpen, Download, Upload, RotateCcw, RefreshCw, ShieldCheck, ShieldAlert, TerminalSquare } from 'lucide-react'
import { useSettings, useUpdateSettings, useWrapperPathDiagnostics } from '@/hooks/useSettings'
import { useI18n } from '@/lib/i18n'
import { useToastStore } from '@/hooks/useToast'
import type { AppTheme, ClaudeBinaryVerification } from '@/lib/types'
import { open } from '@tauri-apps/plugin-shell'
import { detectClaudeBinary, verifyClaudeBinary } from '@/lib/api'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { data: settings } = useSettings()
  const { data: wrapperPathDiagnostics, isFetching: isCheckingWrapperPath } = useWrapperPathDiagnostics(Boolean(settings))
  const updateSettings = useUpdateSettings()
  const { language, setLanguage, t } = useI18n()
  const { addToast } = useToastStore()

  const [theme, setTheme] = useState(settings?.theme ?? 'system')
  const [startProxyOnLaunch, setStartProxyOnLaunch] = useState(settings?.startProxyOnLaunch ?? true)
  const [startAppOnLogin, setStartAppOnLogin] = useState(settings?.startAppOnLogin ?? false)
  const [claudeBinaryPath, setClaudeBinaryPath] = useState(settings?.claudeBinaryPath ?? '')
  const [isDetectingClaude, setIsDetectingClaude] = useState(false)
  const [isVerifyingClaude, setIsVerifyingClaude] = useState(false)
  const [verification, setVerification] = useState<ClaudeBinaryVerification | null>(null)

  useEffect(() => {
    if (settings) {
      setTheme(settings.theme)
      setStartProxyOnLaunch(settings.startProxyOnLaunch)
      setStartAppOnLogin(settings.startAppOnLogin)
      setClaudeBinaryPath(settings.claudeBinaryPath ?? '')
      setVerification(null)
    }
  }, [settings])

  const handleDetectClaudeBinary = async () => {
    try {
      setIsDetectingClaude(true)
      const result = await detectClaudeBinary()

      if (result.found && result.path) {
        setClaudeBinaryPath(result.path)
        addToast('success', t('settings.binaryDetected'))
      } else {
        addToast('error', t('settings.binaryNotFound'))
      }
    } catch {
      addToast('error', t('error.generic'))
    } finally {
      setIsDetectingClaude(false)
    }
  }

  const handleVerifyClaudeBinary = async () => {
    try {
      setIsVerifyingClaude(true)
      const result = await verifyClaudeBinary(claudeBinaryPath)
      setVerification(result)

      addToast(result.runnable ? 'success' : 'error', result.message)
    } catch {
      addToast('error', t('error.generic'))
    } finally {
      setIsVerifyingClaude(false)
    }
  }

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        theme: theme as AppTheme,
        startProxyOnLaunch,
        startAppOnLogin,
        claudeBinaryPath,
      })
      addToast('success', t('settings.settings') + ' ' + t('profile.saved').toLowerCase())
      onClose()
    } catch {
      addToast('error', t('error.generic'))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 1 }}
        className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-xl mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)]">
          <h2 className="text-lg font-semibold">{t('settings.settings')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
              {t('settings.general')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('settings.language')}</p>
                  <p className="text-sm text-[var(--text-muted)]">{t('settings.languageHint')}</p>
                </div>
                <select
                  className="input w-32"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'zh' | 'en')}
                >
                  <option value="zh">简体中文</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('settings.theme')}</p>
                  <p className="text-sm text-[var(--text-muted)]">{t('settings.themeHint')}</p>
                </div>
                <select
                  className="input w-32"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as AppTheme)}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('settings.startOnLogin')}</p>
                  <p className="text-sm text-[var(--text-muted)]">{t('settings.startOnLoginHint')}</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={startAppOnLogin}
                  onChange={(e) => setStartAppOnLogin(e.target.checked)}
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
              {t('settings.proxy')}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('settings.host')}</label>
                  <input
                    className="input"
                    value={settings?.proxyHost ?? '127.0.0.1'}
                    readOnly
                  />
                </div>
                <div>
                  <label className="label">{t('settings.port')}</label>
                  <input
                    className="input"
                    value={settings?.proxyPort ?? 28789}
                    readOnly
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('settings.startProxyOnLaunch')}</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={startProxyOnLaunch}
                  onChange={(e) => setStartProxyOnLaunch(e.target.checked)}
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
              {t('settings.claudeCode')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">{t('settings.claudeBinaryPath')}</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={claudeBinaryPath}
                    onChange={(e) => setClaudeBinaryPath(e.target.value)}
                    placeholder={t('settings.claudeBinaryHint')}
                  />
                  <button
                    className="btn-secondary flex items-center gap-2"
                    type="button"
                    onClick={handleDetectClaudeBinary}
                    disabled={isDetectingClaude}
                  >
                    <RefreshCw className={`w-4 h-4 ${isDetectingClaude ? 'animate-spin' : ''}`} />
                    {isDetectingClaude ? t('settings.detecting') : t('settings.detect')}
                  </button>
                  <button
                    className="btn-secondary flex items-center gap-2"
                    type="button"
                    onClick={handleVerifyClaudeBinary}
                    disabled={isVerifyingClaude}
                  >
                    <ShieldCheck className={`w-4 h-4 ${isVerifyingClaude ? 'animate-pulse' : ''}`} />
                    {isVerifyingClaude ? t('settings.verifying') : t('settings.verify')}
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    type="button"
                    onClick={() => setClaudeBinaryPath('')}
                  >
                    {t('settings.useAutoDetect')}
                  </button>
                </div>
                {verification && (
                  <div
                    className={`mt-3 rounded-lg border p-3 text-sm ${
                      verification.runnable
                        ? 'border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]'
                        : 'border-[var(--error)]/20 bg-[var(--error)]/10 text-[var(--error)]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {verification.runnable ? (
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium break-words">{verification.message}</p>
                        {verification.resolvedPath && (
                          <p className="break-all text-xs opacity-90">
                            {t('settings.verifyResolvedPath')}: {verification.resolvedPath}
                          </p>
                        )}
                        <p className="text-xs opacity-90">
                          {t('settings.verifySource')}: {verification.source}
                        </p>
                        {verification.version && (
                          <p className="break-words text-xs opacity-90">
                            {t('settings.verifyVersion')}: {verification.version}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="label">{t('settings.wrapperDir')}</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={settings?.wrapperDir ?? '%LOCALAPPDATA%\\Clair\\bin'}
                    readOnly
                  />
                  <button
                    className="btn-secondary flex items-center gap-2"
                    type="button"
                    onClick={() => {
                      if (settings?.wrapperDir) {
                        open(settings.wrapperDir).catch(() => {})
                      }
                    }}
                    disabled={!settings?.wrapperDir}
                  >
                    <FolderOpen className="w-4 h-4" />
                    {t('settings.openDir')}
                  </button>
                </div>
                {wrapperPathDiagnostics && (
                  <div
                    className={`mt-3 rounded-lg border p-3 text-sm ${
                      wrapperPathDiagnostics.inPath
                        ? 'border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]'
                        : 'border-amber-500/20 bg-amber-500/10 text-amber-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <TerminalSquare className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">
                          {wrapperPathDiagnostics.inPath
                            ? t('settings.wrapperDirInPath')
                            : t('settings.wrapperDirNotInPath')}
                        </p>
                        <p className="break-all text-xs opacity-90">
                          {t('settings.verifyResolvedPath')}: {wrapperPathDiagnostics.resolvedDir}
                        </p>
                        {wrapperPathDiagnostics.matchingEntries.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs opacity-90">{t('settings.pathMatches')}</p>
                            {wrapperPathDiagnostics.matchingEntries.slice(0, 3).map((entry) => (
                              <p key={entry} className="break-all text-xs opacity-90">
                                {entry}
                              </p>
                            ))}
                          </div>
                        )}
                        {!wrapperPathDiagnostics.inPath && (
                          <p className="text-xs opacity-90">
                            {t('settings.wrapperDirPathHint')}
                          </p>
                        )}
                        {isCheckingWrapperPath && (
                          <p className="text-xs opacity-90">{t('settings.checkingPath')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
              {t('settings.data')}
            </h3>
            <div className="flex gap-2">
              <button className="btn-secondary flex items-center gap-2" type="button">
                <Download className="w-4 h-4" />
                {t('settings.export')}
              </button>
              <button className="btn-secondary flex items-center gap-2" type="button">
                <Upload className="w-4 h-4" />
                {t('settings.import')}
              </button>
              <button className="btn-secondary flex items-center gap-2 text-[var(--error)]" type="button">
                <RotateCcw className="w-4 h-4" />
                {t('settings.reset')}
              </button>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)] sticky bottom-0 bg-[var(--surface)]">
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('modal.cancel')}
          </button>
          <button type="button" onClick={handleSave} className="btn-primary" disabled={updateSettings.isPending}>
            {t('settings.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
