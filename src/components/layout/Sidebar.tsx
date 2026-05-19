import { motion } from 'framer-motion'
import { Plus, Cpu, Pencil, Trash2 } from 'lucide-react'
import { useProfiles, useDeleteProfile } from '@/hooks/useProfiles'
import { useProviders } from '@/hooks/useProviders'
import { useUIStore } from '@/hooks/useUIStore'
import { useI18n } from '@/lib/i18n'
import { useToastStore } from '@/hooks/useToast'

export function Sidebar() {
  const { data: profiles = [] } = useProfiles()
  const { data: providers = [] } = useProviders()
  const { selectedProfileId, selectProfile, openModal } = useUIStore()
  const deleteProfile = useDeleteProfile()
  const { t } = useI18n()
  const { addToast } = useToastStore()

  const getProviderName = (providerId: string) => {
    return providers.find((p) => p.id === providerId)?.name ?? 'Unknown'
  }

  return (
    <aside
      className="w-[240px] border-r border-[var(--border)] bg-[var(--background-subtle)] flex flex-col overflow-hidden"
    >
      <div className="p-4 border-b border-[var(--border)]">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {t('profile.profiles')}
        </h2>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {profiles.length === 0 ? (
          <div className="text-center py-8">
            <Cpu className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">{t('profile.noProfiles')}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {t('profile.noProfilesHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {profiles.map((profile) => (
              <motion.button
                key={profile.id}
                onClick={() => selectProfile(profile.id)}
                className={`sidebar-item w-full group ${selectedProfileId === profile.id ? 'active' : ''}`}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2 w-full min-w-0">
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      {profile.isDefault && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">{profile.name}</span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] truncate">
                      {profile.commandName} · {getProviderName(profile.providerId)}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        selectProfile(profile.id)
                        openModal('editProfile')
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); selectProfile(profile.id); openModal('editProfile') } }}
                      className="p-1 rounded hover:bg-[var(--surface-muted)]"
                    >
                      <Pencil className="w-3 h-3" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(t('detail.deleteProfileConfirm'))) {
                          deleteProfile.mutate(profile.id, {
                            onSuccess: () => {
                              if (selectedProfileId === profile.id) selectProfile(null)
                              addToast('success', t('detail.deleted'))
                            },
                          })
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation() } }}
                      className="p-1 rounded hover:bg-[var(--error-soft)] text-[var(--error)]"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        <button
          onClick={() => openModal('addProfile')}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('profile.add')}
        </button>
      </div>
    </aside>
  )
}