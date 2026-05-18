import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, FolderOpen, Download, Upload, RotateCcw } from 'lucide-react'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useI18n } from '@/lib/i18n'
import { useToastStore } from '@/hooks/useToast'
import type { AppTheme } from '@/lib/types'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { language, setLanguage, t } = useI18n()
  const { addToast } = useToastStore()

  const [theme, setTheme] = useState(settings?.theme ?? 'system')
  const [startProxyOnLaunch, setStartProxyOnLaunch] = useState(settings?.startProxyOnLaunch ?? true)
  const [startAppOnLogin, setStartAppOnLogin] = useState(settings?.startAppOnLogin ?? false)

  useEffect(() => {
    if (settings) {
      setTheme(settings.theme)
      setStartProxyOnLaunch(settings.startProxyOnLaunch)
      setStartAppOnLogin(settings.startAppOnLogin)
    }
  }, [settings])

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        theme: theme as AppTheme,
        startProxyOnLaunch,
        startAppOnLogin,
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
                    defaultValue={settings?.claudeBinaryPath}
                    placeholder="Auto-detected"
                  />
                  <button className="btn-secondary flex items-center gap-2" type="button">
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="label">{t('settings.wrapperDir')}</label>
                <input
                  className="input"
                  value={settings?.wrapperDir ?? '~/.local/bin'}
                  readOnly
                />
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
