import type { Provider, ProviderType } from '@/lib/types'

const BRAND_COLORS: Record<string, { bg: string; text: string }> = {
  glm: { bg: 'bg-purple-100', text: 'text-purple-600' },
  minimax: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  deepseek: { bg: 'bg-blue-100', text: 'text-blue-600' },
  anthropic: { bg: 'bg-orange-100', text: 'text-orange-600' },
  openai: { bg: 'bg-green-100', text: 'text-green-600' },
}

const TYPE_COLORS: Record<ProviderType, { bg: string; text: string }> = {
  anthropic_compatible: { bg: 'bg-blue-100', text: 'text-blue-600' },
  openai_compatible: { bg: 'bg-green-100', text: 'text-green-600' },
  custom: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

function resolveColors(name: string, type: ProviderType) {
  const key = name.toLowerCase()
  for (const [keyword, colors] of Object.entries(BRAND_COLORS)) {
    if (key.includes(keyword)) return colors
  }
  return TYPE_COLORS[type] ?? TYPE_COLORS.custom
}

interface ProviderAvatarProps {
  provider: Pick<Provider, 'name' | 'type'>
  size?: 'sm' | 'lg'
}

export function ProviderAvatar({ provider, size = 'sm' }: ProviderAvatarProps) {
  const colors = resolveColors(provider.name, provider.type)
  const sizeClass = size === 'lg' ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'

  return (
    <div
      className={`${sizeClass} rounded-lg flex items-center justify-center font-semibold flex-shrink-0 ${colors.bg} ${colors.text}`}
    >
      {provider.name.charAt(0).toUpperCase()}
    </div>
  )
}
