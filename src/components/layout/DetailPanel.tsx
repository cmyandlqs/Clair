import { Copy, RefreshCw, FileCode, Plus, Zap, CheckCircle, XCircle, FolderOpen } from 'lucide-react'
import { useProviders, useTestProvider, useUpdateProvider } from '@/hooks/useProviders'
import { useProfiles, useGenerateWrapper, useTestProfile, useWrapperStatus } from '@/hooks/useProfiles'
import { useProxyStatus, useProxyEvidence } from '@/hooks/useProxyStatus'
import { useUIStore } from '@/hooks/useUIStore'
import { useState } from 'react'
import { Badge } from '../common/Badge'
import { useI18n } from '@/lib/i18n'
import { open } from '@tauri-apps/plugin-shell'

export function DetailPanel() {
  const { selectedProfileId, selectedProviderId, openModal } = useUIStore()
  const { data: providers = [] } = useProviders()
  const { data: profiles = [] } = useProfiles()
  const { data: proxyStatus } = useProxyStatus()
  const { data: proxyEvidence = [] } = useProxyEvidence(30)
  const { data: wrapperStatus } = useWrapperStatus(selectedProfileId ?? undefined)
  const testProvider = useTestProvider()
  const testProfile = useTestProfile()
  const updateProvider = useUpdateProvider()
  const generateWrapper = useGenerateWrapper()
  const [testResult, setTestResult] = useState<string | null>(null)
  const [profileTestResult, setProfileTestResult] = useState<string | null>(null)
  const [wrapperResult, setWrapperResult] = useState<{ success: boolean; message: string } | null>(null)
  const { t } = useI18n()

  const handleTestProvider = async () => {
    if (!selectedProviderId) return
    try {
      const result = await testProvider.mutateAsync(selectedProviderId)
      setTestResult(result.ok ? t('provider.connected', { latency: String(result.latencyMs ?? '?'), model: result.model ?? '' }) : `${t('provider.connectionFailed')}: ${result.message}`)
      if (result.ok) {
        updateProvider.mutate({ id: selectedProviderId, status: 'ready' })
      }
    } catch {
      setTestResult(t('error.connectionFailed'))
    }
  }

  const handleGenerateWrapper = async (profileId: string) => {
    try {
      setWrapperResult(null)
      const result = await generateWrapper.mutateAsync(profileId)
      const details = result.settingsPath ? `${result.path} | ${result.settingsPath}` : result.path
      setWrapperResult({ success: true, message: `Generated: ${details}` })
    } catch (error) {
      setWrapperResult({ success: false, message: `Failed: ${error}` })
    }
  }

  const handleTestProfile = async (profileId: string) => {
    try {
      const result = await testProfile.mutateAsync(profileId)
      const latency = result.latencyMs ?? '?'
      const evidence = result.evidence
      const rewriteSummary = evidence?.rewrittenModel
        ? ` | rewrite: ${evidence.originalModel ?? '(none)'} -> ${evidence.rewrittenModel}`
        : ''
      setProfileTestResult(
        result.ok
          ? `${result.message} | ${latency}ms${rewriteSummary}`
          : `${result.message}${rewriteSummary}`
      )
    } catch (error) {
      setProfileTestResult(`Failed: ${error}`)
    }
  }

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const selectedProvider = providers.find((p) => p.id === selectedProviderId)

  if (!selectedProfile && !selectedProvider) {
    return (
      <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] flex items-center justify-center">
        <div className="text-center text-[var(--text-muted)]">
          <FileCode className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('detail.selectProfileOrProvider')}</p>
          <p className="text-xs mt-1">{t('detail.toSeeDetails')}</p>
        </div>
      </aside>
    )
  }

  if (selectedProfile) {
    const provider = providers.find((p) => p.id === selectedProfile.providerId)
    const baseUrl = proxyStatus?.running
      ? `http://${proxyStatus.host}:${proxyStatus.port}${selectedProfile.routePath}`
      : t('proxy.stopped')
    const routeEvidence = proxyEvidence
      .filter((entry) => entry.routePath === selectedProfile.routePath)
      .slice(-5)
      .reverse()
    const launcherPath = wrapperStatus?.path
    const profileSettingsPath = wrapperStatus?.settingsPath
    const launcherDir = launcherPath ? launcherPath.replace(/[\\/][^\\/]+$/, '') : undefined

    return (
      <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] overflow-auto">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold">{t('profile.details')}</h2>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="label">{t('detail.name')}</label>
            <p className="text-lg font-medium">{selectedProfile.name}</p>
          </div>

          <div>
            <label className="label">{t('detail.route')}</label>
            <p className="font-mono text-sm bg-[var(--surface-muted)] px-3 py-2 rounded-lg">
              {baseUrl}
            </p>
          </div>

          <div>
            <label className="label">{t('detail.command')}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-[var(--surface-muted)] px-3 py-2 rounded-lg">
                {selectedProfile.commandName}
              </code>
              <button className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {launcherPath && (
            <div>
              <label className="label">{t('detail.launcherPath')}</label>
              <p className="font-mono text-xs bg-[var(--surface-muted)] px-3 py-2 rounded-lg break-all">
                {launcherPath}
              </p>
            </div>
          )}

          {profileSettingsPath && (
            <div>
              <label className="label">{t('detail.profileSettingsPath')}</label>
              <p className="font-mono text-xs bg-[var(--surface-muted)] px-3 py-2 rounded-lg break-all">
                {profileSettingsPath}
              </p>
            </div>
          )}

          <div>
            <label className="label">{t('detail.provider')}</label>
            <p>{provider?.name ?? 'Unknown'} · {selectedProfile.model}</p>
          </div>

          <div>
            <label className="label">{t('detail.runtimeModel')}</label>
            <p className="text-sm text-[var(--text-muted)]">
              {t('detail.runtimeModelHint')}
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--border)]">
            {profileTestResult && (
              <div className="mb-3 p-2 rounded-lg text-sm bg-[var(--surface-muted)] text-[var(--text)]">
                {profileTestResult}
              </div>
            )}
            {wrapperResult && (
              <div className={`mb-3 p-2 rounded-lg text-sm flex items-center gap-2 ${
                wrapperResult.success
                  ? 'bg-[var(--success)]/10 text-[var(--success)]'
                  : 'bg-[var(--error)]/10 text-[var(--error)]'
              }`}>
                {wrapperResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {wrapperResult.message}
              </div>
            )}
            {wrapperStatus && (
              <div className={`mb-3 p-2 rounded-lg text-sm ${
                wrapperStatus.exists && !wrapperStatus.stale
                  ? 'bg-[var(--success)]/10 text-[var(--success)]'
                  : 'bg-amber-500/10 text-amber-700'
              }`}>
                {wrapperStatus.exists
                  ? wrapperStatus.stale
                    ? t('detail.wrapperStale')
                    : t('detail.wrapperReady')
                  : t('detail.wrapperMissing')}
              </div>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedProfile.commandName)
              }}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              {t('detail.copyCommand')}
            </button>
            <button
              onClick={() => {
                if (launcherPath) {
                  navigator.clipboard.writeText(launcherPath)
                }
              }}
              disabled={!launcherPath}
              className="w-full btn-secondary mt-2 flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              {t('detail.copyLauncherPath')}
            </button>
            <button
              onClick={() => {
                if (profileSettingsPath) {
                  navigator.clipboard.writeText(profileSettingsPath)
                }
              }}
              disabled={!profileSettingsPath}
              className="w-full btn-secondary mt-2 flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              {t('detail.copyProfileSettingsPath')}
            </button>
            <button
              onClick={() => {
                if (launcherDir) {
                  open(launcherDir).catch(() => {})
                }
              }}
              disabled={!launcherDir}
              className="w-full btn-secondary mt-2 flex items-center justify-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              {t('detail.openLauncherDir')}
            </button>
            <button
              onClick={() => handleGenerateWrapper(selectedProfile.id)}
              disabled={generateWrapper.isPending}
              className="w-full btn-primary mt-2 flex items-center justify-center gap-2"
            >
                <RefreshCw className={`w-4 h-4 ${generateWrapper.isPending ? 'animate-spin' : ''}`} />
                {generateWrapper.isPending ? t('detail.generating') : t('detail.regenerate')}
              </button>
            <button
              onClick={() => handleTestProfile(selectedProfile.id)}
              disabled={testProfile.isPending}
              className="w-full btn-secondary mt-2 flex items-center justify-center gap-2"
            >
              <Zap className={`w-4 h-4 ${testProfile.isPending ? 'animate-pulse' : ''}`} />
              {testProfile.isPending ? t('detail.testing') : t('profile.testRoute')}
            </button>
          </div>

          <div className="pt-4 border-t border-[var(--border)]">
            <label className="label">{t('detail.evidence')}</label>
            {routeEvidence.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t('detail.noEvidence')}</p>
            ) : (
              <div className="space-y-2">
                {routeEvidence.map((entry) => (
                  <div key={entry.id} className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{entry.outcome}</span>
                      <span className="text-[var(--text-muted)]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div>{entry.providerName ?? provider?.name ?? 'Unknown'} · {entry.statusCode ?? '-'}</div>
                    <div className="break-all">{entry.upstreamUrl ?? entry.requestPath}</div>
                    <div>
                      {t('detail.modelRewrite')}: {entry.originalModel ?? '(none)'} {'->'} {entry.rewrittenModel ?? '(none)'}
                    </div>
                    {entry.error && (
                      <div className="text-[var(--error)] break-all">{entry.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    )
  }

  if (selectedProvider) {
    const isReady = selectedProvider.status === 'ready'
    const profileCount = profiles.filter(p => p.providerId === selectedProvider.id).length

    return (
      <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] overflow-auto">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold">{t('provider.details')}</h2>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-semibold">
              {selectedProvider.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{selectedProvider.name}</p>
              <Badge status={selectedProvider.status} />
            </div>
          </div>

          <div>
            <label className="label">{t('provider.baseUrl')}</label>
            <p className="font-mono text-sm">{selectedProvider.baseUrl}</p>
          </div>

          <div>
            <label className="label">{t('detail.type')}</label>
            <p>{selectedProvider.type}</p>
          </div>

          <div>
            <label className="label">{t('detail.authScheme')}</label>
            <p>{selectedProvider.authScheme}</p>
          </div>

          <div>
            <label className="label">{t('detail.defaultModel')}</label>
            <p>{selectedProvider.defaultModel}</p>
          </div>

          {selectedProvider.lastTestedAt && (
            <div>
              <label className="label">{t('detail.lastTested')}</label>
              <p className="text-sm text-[var(--text-muted)]">
                {new Date(selectedProvider.lastTestedAt).toLocaleString()}
              </p>
            </div>
          )}

          {isReady && (
            <div className="rounded-xl bg-gradient-to-r from-[var(--primary)]/5 to-[var(--success)]/5 p-4 border border-[var(--primary)]/20">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[var(--primary)]" />
                <span className="font-medium text-sm">{t('detail.providerReady')}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                {t('detail.nextStep')}
              </p>
              <button
                onClick={() => openModal('addProfile')}
                className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-2"
              >
                <Plus className="w-4 h-4" />
                {t('detail.createProfile')}
              </button>
              {profileCount > 0 && (
                <p className="text-xs text-center text-[var(--text-muted)] mt-2">
                  {t('detail.alreadyUsing', { count: String(profileCount) })}
                </p>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-[var(--border)]">
            {testResult && (
              <div className={`mb-3 p-2 rounded-lg text-sm ${
                testResult.startsWith(t('provider.connected').substring(0, 5))
                  ? 'bg-[var(--success)]/10 text-[var(--success)]'
                  : 'bg-[var(--error)]/10 text-[var(--error)]'
              }`}>
                {testResult}
              </div>
            )}
            <button
              onClick={handleTestProvider}
              disabled={testProvider.isPending}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              {testProvider.isPending ? t('detail.testing') : t('testConnection')}
            </button>
          </div>
        </div>
      </aside>
    )
  }

  return null
}
