import { invoke } from '@tauri-apps/api/core'
import type {
  Provider,
  Profile,
  ProviderType,
  AuthScheme,
  ProviderStatus,
  AppSettings,
  ProxyStatus,
  TestProviderResult,
  TestProfileResult,
  ProxyEvidenceEntry,
  WrapperStatus,
  WrapperPathDiagnostics,
  ClaudeBinaryDetection,
  ClaudeBinaryVerification,
  GenerateWrapperResult,
} from './types'

export type CreateProviderInput = {
  name: string
  type: 'anthropic_compatible' | 'openai_compatible' | 'custom'
  baseUrl: string
  apiKey: string
  authScheme: 'x_api_key' | 'bearer'
  defaultModel: string
  enableStreaming: boolean
  notes?: string
}

export type UpdateProviderInput = {
  id: string
  name?: string
  type?: 'anthropic_compatible' | 'openai_compatible' | 'custom'
  baseUrl?: string
  apiKey?: string
  authScheme?: 'x_api_key' | 'bearer'
  defaultModel?: string
  enableStreaming?: boolean
  notes?: string
  status?: 'ready' | 'untested' | 'error' | 'disabled'
}

export type CreateProfileInput = {
  name: string
  routePath: string
  providerId: string
  model: string
  commandName: string
  isDefault: boolean
  wrapperEnabled: boolean
}

export type UpdateProfileInput = {
  id: string
  name?: string
  routePath?: string
  providerId?: string
  model?: string
  commandName?: string
  isDefault?: boolean
  wrapperEnabled?: boolean
}

// Convert snake_case backend response to camelCase
function convertProviderFromBackend(p: Record<string, unknown>): Provider {
  return {
    id: p.id as string,
    name: p.name as string,
    type: p.provider_type as ProviderType,
    baseUrl: p.base_url as string,
    apiKey: p.api_key as string,
    authScheme: p.auth_scheme as AuthScheme,
    defaultModel: p.default_model as string,
    enableStreaming: p.enable_streaming as boolean,
    notes: p.notes as string | undefined,
    status: p.status as ProviderStatus,
    lastTestedAt: p.last_tested_at as string | undefined,
    createdAt: p.created_at as string,
    updatedAt: p.updated_at as string,
  }
}

function convertProfileFromBackend(p: Record<string, unknown>): Profile {
  return {
    id: p.id as string,
    name: p.name as string,
    routePath: p.route_path as string,
    providerId: p.provider_id as string,
    model: p.model as string,
    commandName: p.command_name as string,
    isDefault: p.is_default as boolean,
    wrapperEnabled: p.wrapper_enabled as boolean,
    wrapperPath: p.wrapper_path as string | undefined,
    createdAt: p.created_at as string,
    updatedAt: p.updated_at as string,
  }
}

function convertSettingsFromBackend(settings: Record<string, unknown>): AppSettings {
  return {
    proxyHost: settings.proxy_host as string,
    proxyPort: settings.proxy_port as number,
    proxyAuthToken: settings.proxy_auth_token as string,
    startProxyOnLaunch: settings.start_proxy_on_launch as boolean,
    startAppOnLogin: settings.start_app_on_login as boolean,
    minimizeToTray: settings.minimize_to_tray as boolean,
    wrapperDir: settings.wrapper_dir as string,
    claudeBinaryPath: settings.claude_binary_path as string | undefined,
    theme: settings.theme as AppSettings['theme'],
  }
}

function convertProxyStatusFromBackend(status: Record<string, unknown>): ProxyStatus {
  const activeRoutes = (status.active_routes as Record<string, unknown>[] | undefined) ?? []

  return {
    running: status.running as boolean,
    host: status.host as string,
    port: status.port as number,
    activeRoutes: activeRoutes.map((route) => ({
      routePath: route.route_path as string,
      profileName: route.profile_name as string,
      providerName: route.provider_name as string,
    })),
  }
}

function convertWrapperStatusFromBackend(status: Record<string, unknown>): WrapperStatus {
  return {
    exists: status.exists as boolean,
    executable: status.executable as boolean,
    path: status.path as string | undefined,
    inPath: status.in_path as boolean,
    stale: status.stale as boolean,
    settingsPath: status.settings_path as string | undefined,
    settingsExists: status.settings_exists as boolean,
  }
}

function convertGenerateWrapperResultFromBackend(
  result: Record<string, unknown>
): GenerateWrapperResult {
  return {
    success: result.success as boolean,
    path: result.path as string,
    settingsPath: result.settings_path as string | undefined,
    commandName: result.command_name as string,
  }
}

function convertProxyEvidenceEntryFromBackend(
  entry: Record<string, unknown>
): ProxyEvidenceEntry {
  return {
    id: entry.id as string,
    timestamp: entry.timestamp as string,
    requestPath: entry.request_path as string,
    routePath: entry.route_path as string | undefined,
    profileName: entry.profile_name as string | undefined,
    providerName: entry.provider_name as string | undefined,
    providerType: entry.provider_type as string | undefined,
    requestSource: entry.request_source as string | undefined,
    upstreamUrl: entry.upstream_url as string | undefined,
    originalModel: entry.original_model as string | undefined,
    rewrittenModel: entry.rewritten_model as string | undefined,
    authResult: entry.auth_result as string,
    outcome: entry.outcome as string,
    statusCode: entry.status_code as number | undefined,
    latencyMs: entry.latency_ms as number | undefined,
    error: entry.error as string | undefined,
  }
}

function convertTestProfileResultFromBackend(
  result: Record<string, unknown>
): TestProfileResult {
  const evidence = result.evidence as Record<string, unknown> | undefined

  return {
    ok: result.ok as boolean,
    latencyMs: result.latency_ms as number | undefined,
    message: result.message as string,
    routePath: result.route_path as string,
    providerName: result.provider_name as string,
    expectedModel: result.expected_model as string,
    localUrl: result.local_url as string,
    statusCode: result.status_code as number | undefined,
    evidence: evidence ? convertProxyEvidenceEntryFromBackend(evidence) : undefined,
  }
}

// ============ Provider Commands ============

export async function listProviders(): Promise<Provider[]> {
  try {
    const result = await invoke<Record<string, unknown>[]>('list_providers')
    return result.map(convertProviderFromBackend)
  } catch (error) {
    console.error('[listProviders] error:', error)
    throw error
  }
}

export async function createProvider(input: CreateProviderInput): Promise<Provider> {
  try {
    const payload = {
      name: input.name,
      type: input.type,
      base_url: input.baseUrl,
      api_key: input.apiKey,
      auth_scheme: input.authScheme,
      default_model: input.defaultModel,
      enable_streaming: input.enableStreaming,
      notes: input.notes,
    }
    console.log('[createProvider] input:', payload)
    const result = await invoke<Record<string, unknown>>('create_provider', { input: payload })
    return convertProviderFromBackend(result)
  } catch (error) {
    console.error('[createProvider] error:', error)
    throw error
  }
}

export async function updateProvider(input: UpdateProviderInput): Promise<Provider> {
  try {
    const payload: Record<string, unknown> = { id: input.id }
    if (input.name !== undefined) payload.name = input.name
    if (input.type !== undefined) payload.type = input.type
    if (input.baseUrl !== undefined) payload.base_url = input.baseUrl
    if (input.apiKey !== undefined) payload.api_key = input.apiKey
    if (input.authScheme !== undefined) payload.auth_scheme = input.authScheme
    if (input.defaultModel !== undefined) payload.default_model = input.defaultModel
    if (input.enableStreaming !== undefined) payload.enable_streaming = input.enableStreaming
    if (input.notes !== undefined) payload.notes = input.notes
    if (input.status !== undefined) payload.status = input.status
    console.log('[updateProvider] input:', payload)
    const result = await invoke<Record<string, unknown>>('update_provider', { input: payload })
    return convertProviderFromBackend(result)
  } catch (error) {
    console.error('[updateProvider] error:', error)
    throw error
  }
}

export async function deleteProvider(id: string): Promise<boolean> {
  try {
    return await invoke<boolean>('delete_provider', { id })
  } catch (error) {
    console.error('[deleteProvider] error:', error)
    throw error
  }
}

export async function testProvider(id: string): Promise<TestProviderResult> {
  try {
    const result = await invoke<Record<string, unknown>>('test_provider', { id })
    return {
      ok: result.ok as boolean,
      latencyMs: result.latency_ms as number | undefined,
      message: result.message as string,
      model: result.model as string | undefined,
      streamingSupported: result.streaming_supported as boolean | undefined,
    }
  } catch (error) {
    console.error('[testProvider] error:', error)
    throw error
  }
}

export type TestProviderConfigInput = {
  providerType: 'anthropic_compatible' | 'openai_compatible' | 'custom'
  baseUrl: string
  apiKey: string
  authScheme: 'x_api_key' | 'bearer'
  defaultModel: string
}

export async function testProviderConfig(input: TestProviderConfigInput): Promise<TestProviderResult> {
  try {
    const result = await invoke<Record<string, unknown>>('test_provider_config', {
      input: {
        provider_type: input.providerType,
        base_url: input.baseUrl,
        api_key: input.apiKey,
        auth_scheme: input.authScheme,
        default_model: input.defaultModel,
      },
    })
    return {
      ok: result.ok as boolean,
      latencyMs: result.latency_ms as number | undefined,
      message: result.message as string,
      model: result.model as string | undefined,
      streamingSupported: result.streaming_supported as boolean | undefined,
    }
  } catch (error) {
    console.error('[testProviderConfig] error:', error)
    throw error
  }
}

// ============ Profile Commands ============

export async function listProfiles(): Promise<Profile[]> {
  try {
    const result = await invoke<Record<string, unknown>[]>('list_profiles')
    return result.map(convertProfileFromBackend)
  } catch (error) {
    console.error('[listProfiles] error:', error)
    throw error
  }
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  try {
    const payload = {
      name: input.name,
      route_path: input.routePath,
      provider_id: input.providerId,
      model: input.model,
      command_name: input.commandName,
      is_default: input.isDefault,
      wrapper_enabled: input.wrapperEnabled,
    }
    console.log('[createProfile] input:', payload)
    const result = await invoke<Record<string, unknown>>('create_profile', { input: payload })
    return convertProfileFromBackend(result)
  } catch (error) {
    console.error('[createProfile] error:', error)
    throw error
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  try {
    const payload: Record<string, unknown> = { id: input.id }
    if (input.name !== undefined) payload.name = input.name
    if (input.routePath !== undefined) payload.route_path = input.routePath
    if (input.providerId !== undefined) payload.provider_id = input.providerId
    if (input.model !== undefined) payload.model = input.model
    if (input.commandName !== undefined) payload.command_name = input.commandName
    if (input.isDefault !== undefined) payload.is_default = input.isDefault
    if (input.wrapperEnabled !== undefined) payload.wrapper_enabled = input.wrapperEnabled
    console.log('[updateProfile] input:', payload)
    const result = await invoke<Record<string, unknown>>('update_profile', { input: payload })
    return convertProfileFromBackend(result)
  } catch (error) {
    console.error('[updateProfile] error:', error)
    throw error
  }
}

export async function deleteProfile(id: string): Promise<boolean> {
  try {
    return await invoke<boolean>('delete_profile', { id })
  } catch (error) {
    console.error('[deleteProfile] error:', error)
    throw error
  }
}

export async function setDefaultProfile(id: string): Promise<Profile> {
  try {
    const result = await invoke<Record<string, unknown>>('set_default_profile', { id })
    return convertProfileFromBackend(result)
  } catch (error) {
    console.error('[setDefaultProfile] error:', error)
    throw error
  }
}

export async function testProfile(profileId: string): Promise<TestProfileResult> {
  try {
    const result = await invoke<Record<string, unknown>>('test_profile', { profileId })
    return convertTestProfileResultFromBackend(result)
  } catch (error) {
    console.error('[testProfile] error:', error)
    throw error
  }
}

// ============ Proxy Commands ============

export async function getProxyStatus(): Promise<ProxyStatus> {
  const result = await invoke<Record<string, unknown>>('get_proxy_status')
  return convertProxyStatusFromBackend(result)
}

export async function startProxy(): Promise<ProxyStatus> {
  const result = await invoke<Record<string, unknown>>('start_proxy')
  return convertProxyStatusFromBackend(result)
}

export async function stopProxy(): Promise<ProxyStatus> {
  const result = await invoke<Record<string, unknown>>('stop_proxy')
  return convertProxyStatusFromBackend(result)
}

export async function restartProxy(): Promise<ProxyStatus> {
  const result = await invoke<Record<string, unknown>>('restart_proxy')
  return convertProxyStatusFromBackend(result)
}

export async function reloadProxyConfig(): Promise<ProxyStatus> {
  const result = await invoke<Record<string, unknown>>('reload_proxy_config')
  return convertProxyStatusFromBackend(result)
}

export async function getProxyEvidence(limit = 20): Promise<ProxyEvidenceEntry[]> {
  const result = await invoke<Record<string, unknown>[]>('get_proxy_evidence', { limit })
  return result.map(convertProxyEvidenceEntryFromBackend)
}

// ============ Wrapper Commands ============

export async function detectClaudeBinary(): Promise<ClaudeBinaryDetection> {
  return invoke('detect_claude_binary')
}

export async function verifyClaudeBinary(path?: string): Promise<ClaudeBinaryVerification> {
  const result = await invoke<Record<string, unknown>>('verify_claude_binary', {
    path: path && path.trim().length > 0 ? path.trim() : null,
  })

  return {
    configuredPath: result.configured_path as string | undefined,
    resolvedPath: result.resolved_path as string | undefined,
    source: result.source as string,
    runnable: result.runnable as boolean,
    version: result.version as string | undefined,
    message: result.message as string,
  }
}

export async function generateWrapper(profileId: string): Promise<GenerateWrapperResult> {
  const result = await invoke<Record<string, unknown>>('generate_wrapper', {
    profileId,
  })
  return convertGenerateWrapperResultFromBackend(result)
}

export async function generateAllWrappers(): Promise<GenerateWrapperResult[]> {
  const result = await invoke<Record<string, unknown>[]>('generate_all_wrappers')
  return result.map(convertGenerateWrapperResultFromBackend)
}

export async function checkWrapperStatus(profileId: string): Promise<WrapperStatus> {
  const result = await invoke<Record<string, unknown>>('check_wrapper_status', {
    profileId,
  })
  return convertWrapperStatusFromBackend(result)
}

export async function getWrapperPathDiagnostics(): Promise<WrapperPathDiagnostics> {
  const result = await invoke<Record<string, unknown>>('get_wrapper_path_diagnostics')
  const matchingEntries = (result.matching_entries as string[] | undefined) ?? []
  const pathEntries = (result.path_entries as string[] | undefined) ?? []

  return {
    configuredDir: result.configured_dir as string,
    resolvedDir: result.resolved_dir as string,
    inPath: result.in_path as boolean,
    matchingEntries,
    pathEntries,
  }
}

// ============ Settings Commands ============

export async function getSettings(): Promise<AppSettings> {
  const result = await invoke<Record<string, unknown>>('get_settings')
  return convertSettingsFromBackend(result)
}

export async function updateSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const payload: Record<string, unknown> = {}
  if (input.proxyHost !== undefined) payload.proxy_host = input.proxyHost
  if (input.proxyPort !== undefined) payload.proxy_port = input.proxyPort
  if (input.proxyAuthToken !== undefined) payload.proxy_auth_token = input.proxyAuthToken
  if (input.startProxyOnLaunch !== undefined) {
    payload.start_proxy_on_launch = input.startProxyOnLaunch
  }
  if (input.startAppOnLogin !== undefined) payload.start_app_on_login = input.startAppOnLogin
  if (input.minimizeToTray !== undefined) payload.minimize_to_tray = input.minimizeToTray
  if (input.wrapperDir !== undefined) payload.wrapper_dir = input.wrapperDir
  if (input.claudeBinaryPath !== undefined) payload.claude_binary_path = input.claudeBinaryPath
  if (input.theme !== undefined) payload.theme = input.theme

  const result = await invoke<Record<string, unknown>>('update_settings', { input: payload })
  return convertSettingsFromBackend(result)
}
