import { motion } from 'framer-motion'
import { TestTube, Pencil, Plus, ExternalLink } from 'lucide-react'
import type { Provider } from '@/lib/types'
import { Badge } from '../common/Badge'
import { useI18n } from '@/lib/i18n'

interface ProviderCardProps {
  provider: Provider
  selected: boolean
  profileCount: number
  onSelect: () => void
  onTest: () => void
  onEdit: () => void
  onCreateProfile: () => void
}

export function ProviderCard({
  provider,
  selected,
  profileCount,
  onSelect,
  onTest,
  onEdit,
  onCreateProfile,
}: ProviderCardProps) {
  const { t } = useI18n()

  return (
    <motion.button
      onClick={onSelect}
      className={`card w-full text-left ${selected ? 'selected' : ''}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
              provider.type === 'anthropic_compatible'
                ? 'bg-blue-100 text-blue-600'
                : provider.type === 'openai_compatible'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {provider.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--text-primary)] truncate">{provider.name}</h3>
            <p className="text-xs text-[var(--text-muted)] font-mono truncate max-w-[180px]">{provider.baseUrl}</p>
          </div>
        </div>
        <Badge status={provider.status} />
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-3">
        <span className="truncate">{provider.defaultModel}</span>
        <span className="text-[var(--border)] flex-shrink-0">·</span>
        <span className="flex-shrink-0">
          {t(profileCount === 1 ? 'detail.profileCount' : 'detail.profileCount_plural', { count: String(profileCount) })}
        </span>
      </div>

      <div className="flex items-center gap-1 pt-2 border-t border-[var(--border)]">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTest()
          }}
          className="btn-ghost p-1.5"
          title="Test connection"
        >
          <TestTube className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="btn-ghost p-1.5"
          title="Edit provider"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCreateProfile()
          }}
          className="btn-ghost p-1.5"
          title="Create profile"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <a
          href={provider.baseUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="btn-ghost p-1.5 ml-auto"
          title="Open URL"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </motion.button>
  )
}