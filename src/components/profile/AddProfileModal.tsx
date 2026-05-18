import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileSchema, type ProfileFormData } from '@/lib/validators'
import { useCreateProfile } from '@/hooks/useProfiles'
import { useProviders } from '@/hooks/useProviders'
import { useI18n } from '@/lib/i18n'

interface AddProfileModalProps {
  onClose: () => void
}

function generateRoutePath(name: string): string {
  return '/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function generateCommandName(name: string): string {
  return 'claude-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function AddProfileModal({ onClose }: AddProfileModalProps) {
  const { data: providers = [] } = useProviders()
  const createProfile = useCreateProfile()
  const { t } = useI18n()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      isDefault: false,
      wrapperEnabled: true,
    },
  })

  const providerId = watch('providerId')

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValue('name', value)
    if (value) {
      setValue('routePath', generateRoutePath(value))
      setValue('commandName', generateCommandName(value))
    }
  }

  const selectedProvider = providers.find((p) => p.id === providerId)

  useEffect(() => {
    if (selectedProvider) {
      setValue('model', selectedProvider.defaultModel, { shouldValidate: true })
    }
  }, [selectedProvider, setValue])

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await createProfile.mutateAsync(data)
      onClose()
    } catch (error) {
      console.error('Failed to create profile:', error)
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
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">{t('profile.create')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4">
            <div>
              <label className="label">{t('profile.name')}</label>
              <input
                {...register('name')}
                onChange={handleNameChange}
                className="input"
                placeholder="Claude MiniMax"
              />
              {errors.name && (
                <p className="text-sm text-[var(--error)] mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="label">{t('profile.provider')}</label>
              <select {...register('providerId')} className="input">
                <option value="">{t('validation.selectProvider')}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.defaultModel})
                  </option>
                ))}
              </select>
              {errors.providerId && (
                <p className="text-sm text-[var(--error)] mt-1">{errors.providerId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('profile.routePath')}</label>
                <input {...register('routePath')} className="input" placeholder="/minimax" />
                {errors.routePath && (
                  <p className="text-sm text-[var(--error)] mt-1">{errors.routePath.message}</p>
                )}
              </div>

              <div>
                <label className="label">{t('profile.command')}</label>
                <input
                  {...register('commandName')}
                  className="input"
                  placeholder="claude-minimax"
                />
                {errors.commandName && (
                  <p className="text-sm text-[var(--error)] mt-1">{errors.commandName.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">{t('profile.model')}</label>
                <input
                  {...register('model')}
                  className="input"
                  placeholder={selectedProvider?.defaultModel ?? 'glm-4'}
                />
              {errors.model && (
                <p className="text-sm text-[var(--error)] mt-1">{errors.model.message}</p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('isDefault')} className="w-4 h-4" />
                <span className="text-sm">{t('profile.setDefault')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('wrapperEnabled')}
                  defaultChecked
                  className="w-4 h-4"
                />
                <span className="text-sm">{t('profile.generateWrapper')}</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="btn-secondary">
              {t('modal.cancel')}
            </button>
            <button type="submit" className="btn-primary">
              {t('profile.create')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
