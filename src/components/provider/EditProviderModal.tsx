import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, TestTube } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { providerSchema, type ProviderFormData } from '@/lib/validators'
import { useUpdateProvider, useTestProvider } from '@/hooks/useProviders'
import { useProviders } from '@/hooks/useProviders'
import { useToastStore } from '@/hooks/useToast'
import { useI18n } from '@/lib/i18n'

interface EditProviderModalProps {
  onClose: () => void
  providerId: string
}

export function EditProviderModal({ onClose, providerId }: EditProviderModalProps) {
  const { data: providers = [] } = useProviders()
  const provider = providers.find((p) => p.id === providerId)

  const [testResult, setTestResult] = useState<string | null>(null)
  const [testSucceeded, setTestSucceeded] = useState<boolean | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const updateProvider = useUpdateProvider()
  const testProvider = useTestProvider()
  const { addToast } = useToastStore()
  const { t } = useI18n()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    trigger,
  } = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: provider?.name,
      type: provider?.type,
      baseUrl: provider?.baseUrl,
      apiKey: provider?.apiKey,
      authScheme: provider?.authScheme,
      defaultModel: provider?.defaultModel,
      enableStreaming: provider?.enableStreaming ?? true,
      notes: provider?.notes,
    },
  })

  useEffect(() => {
    if (provider) {
      reset({
        name: provider.name,
        type: provider.type,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        authScheme: provider.authScheme,
        defaultModel: provider.defaultModel,
        enableStreaming: provider.enableStreaming,
        notes: provider.notes,
      })
    }
  }, [provider, reset])

  const onSubmit = async (data: ProviderFormData) => {
    try {
      await updateProvider.mutateAsync({ id: providerId, ...data })
      addToast('success', t('provider.saved'))
      onClose()
    } catch (error) {
      console.error('Failed to update provider:', error)
      addToast('error', t('error.generic'))
    }
  }

  const handleTest = async () => {
    const isValid = await trigger(['name', 'baseUrl', 'apiKey', 'defaultModel'])
    if (!isValid) {
      addToast('error', t('validation.apiKeyRequired'))
      return
    }

    setIsTesting(true)
    setTestResult(null)
    setTestSucceeded(null)

    try {
      const result = await testProvider.mutateAsync(providerId)

      setTestSucceeded(result.ok)
      setTestResult(
        result.ok
          ? t('provider.connected', { latency: String(result.latencyMs ?? '?'), model: result.model ?? '' })
          : `${t('provider.connectionFailed')}: ${result.message}`
      )

      if (result.ok) {
        addToast('success', t('provider.connected', { latency: String(result.latencyMs ?? '?'), model: result.model ?? '' }))
      } else {
        addToast('error', `${t('provider.connectionFailed')}: ${result.message}`)
      }
    } catch {
      setTestSucceeded(false)
      setTestResult(t('error.connectionFailed'))
      addToast('error', t('error.connectionFailed'))
    } finally {
      setIsTesting(false)
    }
  }

  if (!provider) {
    return null
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
        transition={{ duration: 0.15 }}
        className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">{t('provider.edit')}</h2>
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
              <label className="label">{t('provider.name')}</label>
              <input {...register('name')} className="input" placeholder="Zhipu GLM" />
              {errors.name && (
                <p className="text-sm text-[var(--error)] mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="label">{t('provider.baseUrl')}</label>
              <input
                {...register('baseUrl')}
                className="input"
                placeholder="https://api.example.com"
              />
              {errors.baseUrl && (
                <p className="text-sm text-[var(--error)] mt-1">{errors.baseUrl.message}</p>
              )}
            </div>

            <div>
              <label className="label">{t('provider.apiKey')}</label>
              <input {...register('apiKey')} type="password" className="input" />
              {errors.apiKey && (
                <p className="text-sm text-[var(--error)] mt-1">{errors.apiKey.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('provider.authScheme')}</label>
                <select {...register('authScheme')} className="input">
                  <option value="x_api_key">x-api-key</option>
                  <option value="bearer">Bearer</option>
                </select>
              </div>

              <div>
                <label className="label">{t('provider.defaultModel')}</label>
                <input {...register('defaultModel')} className="input" placeholder="glm-4" />
              </div>
            </div>

            <div>
              <label className="label">{t('notes.optional')}</label>
              <textarea {...register('notes')} className="input" rows={2} />
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  testSucceeded
                    ? 'bg-[var(--success)]/10 text-[var(--success)]'
                    : 'bg-[var(--error)]/10 text-[var(--error)]'
                }`}
              >
                {testResult}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
            <button type="button" onClick={handleTest} disabled={isTesting} className="btn-secondary">
              <TestTube className="w-4 h-4 mr-2" />
              {isTesting ? t('detail.testing') : t('provider.test')}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              {t('modal.cancel')}
            </button>
            <button type="submit" className="btn-primary">
              {t('profile.save')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
