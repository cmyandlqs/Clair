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

export interface ProxyEvidenceEntry {
  id: string
  timestamp: string
  requestPath: string
  routePath?: string
  profileName?: string
  providerName?: string
  providerType?: string
  requestSource?: string
  upstreamUrl?: string
  originalModel?: string
  rewrittenModel?: string
  authResult: string
  outcome: string
  statusCode?: number
  latencyMs?: number
  error?: string
}

export interface TestProfileResult {
  ok: boolean
  latencyMs?: number
  message: string
  routePath: string
  providerName: string
  expectedModel: string
  localUrl: string
  statusCode?: number
  evidence?: ProxyEvidenceEntry
}

export interface WrapperStatus {
  exists: boolean
  executable: boolean
  path?: string
  inPath: boolean
  stale: boolean
  settingsPath?: string
  settingsExists: boolean
}

export interface WrapperPathDiagnostics {
  configuredDir: string
  resolvedDir: string
  inPath: boolean
  matchingEntries: string[]
  pathEntries: string[]
}

export interface ClaudeBinaryDetection {
  found: boolean
  path?: string
  candidates: string[]
}

export interface ClaudeBinaryVerification {
  configuredPath?: string
  resolvedPath?: string
  source: string
  runnable: boolean
  version?: string
  message: string
}

export interface GenerateWrapperResult {
  success: boolean
  path: string
  settingsPath?: string
  commandName: string
}
