export type ProviderType = 'anthropic_compatible' | 'openai_compatible' | 'custom'

export type AuthScheme = 'x_api_key' | 'bearer'

export type ProviderStatus = 'ready' | 'untested' | 'error' | 'disabled'

export interface Provider {
  id: string
  name: string
  type: ProviderType
  baseUrl: string
  apiKey: string
  authScheme: AuthScheme
  defaultModel: string
  enableStreaming: boolean
  notes?: string
  status: ProviderStatus
  lastTestedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Profile {
  id: string
  name: string
  routePath: string
  providerId: string
  model: string
  commandName: string
  isDefault: boolean
  wrapperEnabled: boolean
  wrapperPath?: string
  createdAt: string
  updatedAt: string
}

export type AppTheme = 'system' | 'light' | 'dark'

export interface AppSettings {
  proxyHost: string
  proxyPort: number
  proxyAuthToken: string
  startProxyOnLaunch: boolean
  startAppOnLogin: boolean
  minimizeToTray: boolean
  wrapperDir: string
  claudeBinaryPath?: string
  theme: AppTheme
}

export interface ProxyStatus {
  running: boolean
  host: string
  port: number
  activeRoutes: Array<{
    routePath: string
    profileName: string
    providerName: string
  }>
}

export interface TestProviderResult {
  ok: boolean
  latencyMs?: number
  message: string
  model?: string
  streamingSupported?: boolean
}

export interface WrapperStatus {
  exists: boolean
  executable: boolean
  path?: string
  inPath: boolean
  stale: boolean
}

export interface ClaudeBinaryDetection {
  found: boolean
  path?: string
  candidates: string[]
}

export interface GenerateWrapperResult {
  success: boolean
  path: string
  commandName: string
}