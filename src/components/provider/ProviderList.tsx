import { Package, Plus } from 'lucide-react'
import { useProviders, useTestProvider } from '@/hooks/useProviders'
import { useProfiles } from '@/hooks/useProfiles'
import { useUIStore } from '@/hooks/useUIStore'
import { ProviderCard } from './ProviderCard'
import { useI18n } from '@/lib/i18n'
import { useToastStore } from '@/hooks/useToast'

export function ProviderList() {
  const { data: providers = [] } = useProviders()
  const { data: profiles = [] } = useProfiles()
  const { selectedProviderId, selectProvider, openModal } = useUIStore()
  const { t } = useI18n()
  const { addToast } = useToastStore()
  const testProvider = useTestProvider()

  const getProfileCount = (providerId: string) => {
    return profiles.filter((p) => p.providerId === providerId).length
  }

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          selected={selectedProviderId === provider.id}
          profileCount={getProfileCount(provider.id)}
          onSelect={() => selectProvider(provider.id)}
          onTest={async () => {
            selectProvider(provider.id)
            try {
              const result = await testProvider.mutateAsync(provider.id)
              if (result.ok) {
                addToast(
                  'success',
                  t('provider.connected', {
                    latency: String(result.latencyMs ?? '?'),
                    model: result.model ?? '',
                  })
                )
              } else {
                addToast('error', `${t('provider.connectionFailed')}: ${result.message}`)
              }
            } catch (error) {
              addToast('error', `${t('error.generic')}: ${error}`)
            }
          }}
          onEdit={() => {
            selectProvider(provider.id)
            openModal('editProvider')
          }}
          onCreateProfile={() => {
            selectProvider(provider.id)
            openModal('addProfile')
          }}
        />
      ))}
    </div>
  )
}
