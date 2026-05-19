import { useState, useEffect } from 'react'
import { Package, Plus, ChevronDown, ChevronRight, TestTube, Pencil, Copy, RefreshCw, Trash2 } from 'lucide-react'
import { useProviders, useTestProvider } from '@/hooks/useProviders'
import { useProfiles, useDeleteProfile, useGenerateWrapper } from '@/hooks/useProfiles'
import { useUIStore } from '@/hooks/useUIStore'
import { Badge } from '../common/Badge'
import { useToastStore } from '@/hooks/useToast'
import { useI18n } from '@/lib/i18n'
import { ProviderAvatar } from '../common/ProviderAvatar'
import { motion, AnimatePresence } from 'framer-motion'

export function ProviderList() {
  const { data: providers = [] } = useProviders()
  const { data: profiles = [] } = useProfiles()
  const { selectedProviderId, selectedProfileId, selectProvider, selectProfile, openModal } = useUIStore()
  const { t } = useI18n()
  const { addToast } = useToastStore()
  const testProvider = useTestProvider()
  const deleteProfile = useDeleteProfile()
  const generateWrapper = useGenerateWrapper()
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(() => new Set(providers.map(p => p.id)))

  useEffect(() => {
    setExpandedProviders(prev => {
      const next = new Set(prev)
      for (const p of providers) {
        if (!prev.has(p.id)) next.add(p.id)
      }
      return next
    })
  }, [providers])

  const toggleExpand = (providerId: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(providerId)) {
        next.delete(providerId)
      } else {
        next.add(providerId)
      }
      return next
    })
  }

  const getProfilesForProvider = (providerId: string) =>
    profiles.filter((p) => p.providerId === providerId)

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-30" />
          <p className="font-medium text-[var(--text-secondary)]">{t('provider.noProviders')}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t('provider.noProvidersHint')}
          </p>
          <button
            onClick={() => openModal('addProvider')}
            className="btn-primary mt-4"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            {t('provider.add')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {providers.map((provider) => {
        const providerProfiles = getProfilesForProvider(provider.id)
        const isExpanded = expandedProviders.has(provider.id)
        const isSelected = selectedProviderId === provider.id

        return (
          <div key={provider.id} className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
            <div
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                isSelected ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--surface-muted)]'
              }`}
              onClick={() => {
                selectProvider(provider.id)
                toggleExpand(provider.id)
              }}
            >
              <div className="flex-shrink-0 text-[var(--text-muted)]">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
              <ProviderAvatar provider={provider} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{provider.name}</span>
                  <Badge status={provider.status} />
                </div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {provider.baseUrl}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-xs text-[var(--text-secondary)]">
                <span className="truncate max-w-[120px]">{provider.defaultModel}</span>
                <span className="text-[var(--border)]">·</span>
                <span>
                  {providerProfiles.length} {t('profile.profiles').toLowerCase()}
                </span>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    testProvider.mutate(provider.id, {
                      onSuccess: (result) => {
                        addToast(
                          result.ok ? 'success' : 'error',
                          result.ok
                            ? t('provider.connected', { latency: String(result.latencyMs ?? '?'), model: result.model ?? '' })
                            : `${t('provider.connectionFailed')}: ${result.message}`
                        )
                      },
                      onError: (err) => addToast('error', String(err)),
                    })
                  }}
                  className="btn-ghost p-1.5 text-xs"
                  title={t('testConnection')}
                >
                  <TestTube className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { selectProvider(provider.id); openModal('editProvider') }}
                  className="btn-ghost p-1.5"
                  title={t('provider.edit')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { selectProvider(provider.id); openModal('addProfile') }}
                  className="btn-ghost p-1.5"
                  title={t('provider.createProfile')}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {isExpanded && providerProfiles.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[var(--border)]">
                    {providerProfiles.map((profile) => (
                      <div
                        key={profile.id}
                        className={`flex items-center gap-3 px-4 py-2.5 pl-12 cursor-pointer transition-colors ${
                          selectedProfileId === profile.id
                            ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                            : 'hover:bg-[var(--surface-muted)]'
                        }`}
                        onClick={() => selectProfile(profile.id)}
                      >
                        <code className="text-sm font-mono min-w-[140px] truncate">{profile.commandName}</code>
                        <span className="text-xs text-[var(--text-muted)] font-mono min-w-[60px]">{profile.routePath}</span>
                        <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{profile.model}</span>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(profile.commandName)
                              addToast('success', t('profile.copyCommand'))
                            }}
                            className="btn-ghost p-1 text-xs"
                            title={t('detail.copyCommand')}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              generateWrapper.mutate(profile.id, {
                                onSuccess: () => addToast('success', t('profile.regenerateWrapper')),
                                onError: (err) => addToast('error', String(err)),
                              })
                            }}
                            className="btn-ghost p-1 text-xs"
                            title={t('detail.regenerate')}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(t('detail.deleteProfileConfirm'))) {
                                deleteProfile.mutate(profile.id, {
                                  onSuccess: () => {
                                    if (selectedProfileId === profile.id) selectProfile(null)
                                    addToast('success', t('detail.deleted'))
                                  },
                                })
                              }
                            }}
                            className="btn-ghost p-1 text-xs text-[var(--error)]"
                            title={t('detail.deleteProfile')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isExpanded && providerProfiles.length === 0 && (
              <div className="border-t border-[var(--border)] px-4 py-3 pl-12 text-xs text-[var(--text-muted)]">
                {t('provider.noProvidersHint')}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
