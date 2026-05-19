import { Copy, RefreshCw, FileCode, Plus, Zap, CheckCircle, XCircle, FolderOpen, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useProviders, useTestProvider, useUpdateProvider, useDeleteProvider } from '@/hooks/useProviders'
import { useProfiles, useGenerateWrapper, useTestProfile, useWrapperStatus, useDeleteProfile } from '@/hooks/useProfiles'
import { useProxyStatus, useProxyEvidence } from '@/hooks/useProxyStatus'
import { useUIStore } from '@/hooks/useUIStore'
import { useState } from 'react'
import { Badge } from '../common/Badge'
import { ProviderAvatar } from '../common/ProviderAvatar'
import { TestResultModal } from '../common/TestResultModal'
import { useI18n } from '@/lib/i18n'
import { useToastStore } from '@/hooks/useToast'
import { open } from '@tauri-apps/plugin-shell'
import type { TestProfileResult } from '@/lib/types'

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hover:bg-[var(--surface-muted)] transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export function DetailPanel() {
  const { selectedProfileId, selectedProviderId, openModal, selectProfile, selectProvider } = useUIStore()
  const { data: providers = [] } = useProviders()
  const { data: profiles = [] } = useProfiles()
  const { data: proxyStatus } = useProxyStatus()
  const { data: proxyEvidence = [] } = useProxyEvidence(30)
  const { data: wrapperStatus } = useWrapperStatus(selectedProfileId ?? undefined)
  const testProvider = useTestProvider()
  const testProfile = useTestProfile()
  const updateProvider = useUpdateProvider()
  const generateWrapper = useGenerateWrapper()
  const deleteProfile = useDeleteProfile()
  const deleteProvider = useDeleteProvider()
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testSucceeded, setTestSucceeded] = useState<boolean | null>(null)
  const [profileTestFullResult, setProfileTestFullResult] = useState<TestProfileResult | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [wrapperResult, setWrapperResult] = useState<{ success: boolean; message: string } | null>(null)
  const { t } = useI18n()
  const { addToast } = useToastStore()

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      addToast('error', 'Copy failed')
    })
  }

  const handleTestProvider = async () => {
    if (!selectedProviderId) return
    try {
      const result = await testProvider.mutateAsync(selectedProviderId)
      setTestSucceeded(result.ok)
      setTestResult(result.ok ? t('provider.connected', { latency: String(result.latencyMs ?? '?'), model: result.model ?? '' }) : `${t('provider.connectionFailed')}: ${result.message}`)
      if (result.ok) {
        updateProvider.mutate({ id: selectedProviderId, status: 'ready' })
      }
    } catch {
      setTestSucceeded(false)
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
      setProfileTestFullResult(result)
      setShowTestModal(true)
    } catch (error) {
      setProfileTestFullResult({
        ok: false,
        message: `Failed: ${error}`,
        routePath: '',
        providerName: '',
        expectedModel: '',
        localUrl: '',
      })
      setShowTestModal(true)
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
    const proxyRunning = proxyStatus?.running ?? false

    const wrapperStatusColor = wrapperStatus
      ? (wrapperStatus.exists && !wrapperStatus.stale
          ? 'text-[var(--success)]'
          : 'text-amber-600')
      : 'text-[var(--text-muted)]'
    const wrapperStatusText = wrapperStatus
      ? (wrapperStatus.exists
          ? (wrapperStatus.stale ? t('detail.wrapperStale') : t('detail.wrapperReady'))
          : t('detail.wrapperMissing'))
      : '—'

    const testSummary = profileTestFullResult
      ? (profileTestFullResult.ok
          ? t('detail.testSummaryOk', { latency: String(profileTestFullResult.latencyMs ?? '?') })
          : t('detail.testSummaryFail'))
      : null

    return (
      <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] overflow-auto flex flex-col">
        {showTestModal && profileTestFullResult && (
          <TestResultModal
            result={profileTestFullResult}
            onClose={() => setShowTestModal(false)}
          />
        )}

        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('profile.details')}</h2>
          <div className="flex items-center gap-0.5">
            <button onClick={() => openModal('editProfile')} className="btn-ghost p-1" title={t('detail.editProfile')}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(t('detail.deleteProfileConfirm'))) {
                  deleteProfile.mutate(selectedProfile.id, {
                    onSuccess: () => { selectProfile(null); addToast('success', t('detail.deleted')) },
                    onError: (err) => addToast('error', String(err)),
                  })
                }
              }}
              className="btn-ghost p-1 text-[var(--error)] hover:bg-[var(--error-soft)]"
              title={t('detail.deleteProfile')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Core summary */}
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-base font-semibold mb-1">{selectedProfile.name}</p>
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              {provider?.name ?? 'Unknown'} · {selectedProfile.model}
            </p>
            <div className="flex items-center gap-3 text-[11px]">
              <span className={wrapperStatusColor}>
                {t('detail.launcherStatus')} · {wrapperStatusText}
              </span>
              <span className={proxyRunning ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}>
                {t('detail.proxyStatus')} · {proxyRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            {testSummary && (
              <div className={`mt-1.5 text-[11px] ${profileTestFullResult?.ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                {testSummary}
              </div>
            )}
            {wrapperResult && (
              <div className={`mt-1 text-[11px] flex items-center gap-1 ${
                wrapperResult.success ? 'text-[var(--success)]' : 'text-[var(--error)]'
              }`}>
                {wrapperResult.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                <span className="truncate">{wrapperResult.success ? t('detail.generateOk') : t('detail.generateFail')}</span>
              </div>
            )}
          </div>

          {/* Config fields */}
          <div className="px-4 py-3 border-b border-[var(--border)] space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-muted)] w-14 flex-shrink-0 pt-0.5">{t('detail.route')}</span>
              <code className="font-mono text-[11px] bg-[var(--surface-muted)] px-2 py-0.5 rounded break-all flex-1 min-w-0">{baseUrl}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] w-14 flex-shrink-0">{t('detail.command')}</span>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <code className="font-mono text-[11px] bg-[var(--surface-muted)] px-2 py-0.5 rounded truncate flex-1">{selectedProfile.commandName}</code>
                <button
                  className="p-1 rounded hover:bg-[var(--surface-muted)] flex-shrink-0"
                  onClick={() => copyText(selectedProfile.commandName)}
                  title={t('detail.copyCommand')}
                >
                  <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>
            {launcherPath && (
              <div className="flex items-start gap-2">
                <span className="text-[var(--text-muted)] w-14 flex-shrink-0 pt-0.5">{t('detail.launcherPath')}</span>
                <div className="flex items-start gap-1 flex-1 min-w-0">
                  <code className="font-mono text-[11px] text-[var(--text-secondary)] break-all flex-1 min-w-0 leading-relaxed">{launcherPath}</code>
                  <button
                    className="p-1 rounded hover:bg-[var(--surface-muted)] flex-shrink-0 mt-[-1px]"
                    onClick={() => copyText(launcherPath)}
                    title={t('detail.copyLauncherPath')}
                  >
                    <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                </div>
              </div>
            )}
            {profileSettingsPath && (
              <div className="flex items-start gap-2">
                <span className="text-[var(--text-muted)] w-14 flex-shrink-0 pt-0.5">{t('detail.profileSettingsPath')}</span>
                <div className="flex items-start gap-1 flex-1 min-w-0">
                  <code className="font-mono text-[11px] text-[var(--text-secondary)] break-all flex-1 min-w-0 leading-relaxed">{profileSettingsPath}</code>
                  <button
                    className="p-1 rounded hover:bg-[var(--surface-muted)] flex-shrink-0 mt-[-1px]"
                    onClick={() => copyText(profileSettingsPath)}
                    title={t('detail.copyProfileSettingsPath')}
                  >
                    <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toolbar: grouped icon+text buttons */}
          <div className="px-4 py-3 border-b border-[var(--border)] space-y-2.5">
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">{t('toolbar.runActions')}</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleTestProfile(selectedProfile.id)}
                  disabled={testProfile.isPending}
                  className="btn-secondary flex items-center gap-1 text-[11px] px-2.5 py-1 disabled:opacity-40"
                >
                  <Zap className={`w-3 h-3 ${testProfile.isPending ? 'animate-pulse' : ''}`} />
                  {t('profile.testRoute')}
                </button>
                <button
                  onClick={() => handleGenerateWrapper(selectedProfile.id)}
                  disabled={generateWrapper.isPending}
                  className="btn-secondary flex items-center gap-1 text-[11px] px-2.5 py-1 disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${generateWrapper.isPending ? 'animate-spin' : ''}`} />
                  {t('detail.regenerate')}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">{t('toolbar.clipActions')}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => copyText(selectedProfile.commandName)}
                  className="btn-ghost flex items-center gap-1 text-[11px] px-2 py-1"
                >
                  <Copy className="w-3 h-3" />
                  {t('detail.copyCommand')}
                </button>
                <button
                  onClick={() => { if (launcherPath) copyText(launcherPath) }}
                  disabled={!launcherPath}
                  className="btn-ghost flex items-center gap-1 text-[11px] px-2 py-1 disabled:opacity-40"
                >
                  <Copy className="w-3 h-3" />
                  {t('detail.copyLauncherPath')}
                </button>
                <button
                  onClick={() => { if (profileSettingsPath) copyText(profileSettingsPath) }}
                  disabled={!profileSettingsPath}
                  className="btn-ghost flex items-center gap-1 text-[11px] px-2 py-1 disabled:opacity-40"
                >
                  <Copy className="w-3 h-3" />
                  {t('detail.copyProfileSettingsPath')}
                </button>
                <button
                  onClick={() => { if (launcherDir) open(launcherDir).catch(() => {}) }}
                  disabled={!launcherDir}
                  className="btn-ghost flex items-center gap-1 text-[11px] px-2 py-1 disabled:opacity-40"
                >
                  <FolderOpen className="w-3 h-3" />
                  {t('detail.openLauncherDir')}
                </button>
              </div>
            </div>
          </div>

          {/* Evidence */}
          <CollapsibleSection title={t('detail.section.evidence')} defaultOpen={false}>
            {routeEvidence.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">{t('detail.noEvidence')}</p>
            ) : (
              <div className="space-y-1.5">
                {routeEvidence.map((entry) => {
                  const isProbe = entry.outcome === 'probe'
                  return (
                    <div key={entry.id} className={`rounded p-2 text-[11px] space-y-0.5 leading-relaxed ${
                      isProbe ? 'bg-[var(--surface-muted)]/50 border border-dashed border-[var(--border)]' : 'bg-[var(--surface-muted)]'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${isProbe ? 'text-[var(--text-muted)]' : ''}`}>
                          {isProbe ? t('detail.probeLabel') : entry.outcome}
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {isProbe ? (
                        <div className="text-[var(--text-muted)]">{t('detail.probeDesc')}</div>
                      ) : (
                        <>
                          <div>{entry.providerName ?? provider?.name ?? 'Unknown'} · {entry.statusCode ?? '-'}</div>
                          <div className="break-all">{entry.upstreamUrl ?? entry.requestPath}</div>
                          <div>
                            {t('detail.modelRewrite')}: {entry.originalModel ?? '(none)'} {'->'} {entry.rewrittenModel ?? '(none)'}
                          </div>
                          {entry.error && (
                            <div className="text-[var(--error)] break-all">{entry.error}</div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </aside>
    )
  }

  if (selectedProvider) {
    const isReady = selectedProvider.status === 'ready'
    const profileCount = profiles.filter(p => p.providerId === selectedProvider.id).length

    return (
      <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] overflow-auto">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold">{t('provider.details')}</h2>
          <button
            onClick={() => {
              if (window.confirm(t('detail.deleteProviderConfirm'))) {
                deleteProvider.mutate(selectedProvider.id, {
                  onSuccess: () => { selectProvider(null); addToast('success', t('detail.deleted')) },
                  onError: (err) => addToast('error', String(err)),
                })
              }
            }}
            className="btn-ghost p-1.5 text-[var(--error)] hover:bg-[var(--error-soft)]"
            title={t('detail.deleteProvider')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <ProviderAvatar provider={selectedProvider} size="lg" />
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
                testSucceeded
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
