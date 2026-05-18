import type { ProviderStatus } from '@/lib/types'
import { useI18n } from '@/lib/i18n'

interface BadgeProps {
  status: ProviderStatus
}

const statusConfig: Record<ProviderStatus, { labelKey: string; className: string }> = {
  ready: { labelKey: 'status.ready', className: 'badge badge-success' },
  untested: { labelKey: 'status.untested', className: 'badge badge-warning' },
  error: { labelKey: 'status.error', className: 'badge badge-error' },
  disabled: { labelKey: 'status.disabled', className: 'badge bg-gray-100 text-gray-500' },
}

export function Badge({ status }: BadgeProps) {
  const config = statusConfig[status]
  const { t } = useI18n()

  return (
    <span className={config.className}>
      {t(config.labelKey)}
    </span>
  )
}
