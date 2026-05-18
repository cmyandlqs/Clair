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
  WrapperStatus,
  ClaudeBinaryDetection,
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

// ============ Proxy Commands ============

export async function getProxyStatus(): Promise<ProxyStatus> {
  return invoke('get_proxy_status')
}

export async function startProxy(): Promise<ProxyStatus> {
  return invoke('start_proxy')
}

export async function stopProxy(): Promise<ProxyStatus> {
  return invoke('stop_proxy')
}

export async function restartProxy(): Promise<ProxyStatus> {
  return invoke('restart_proxy')
}

export async function reloadProxyConfig(): Promise<ProxyStatus> {
  return invoke('reload_proxy_config')
}

// ============ Wrapper Commands ============

export async function detectClaudeBinary(): Promise<ClaudeBinaryDetection> {
  return invoke('detect_claude_binary')
}

export async function generateWrapper(profileId: string): Promise<GenerateWrapperResult> {
  return invoke('generate_wrapper', { profileId })
}

export async function generateAllWrappers(): Promise<GenerateWrapperResult[]> {
  return invoke('generate_all_wrappers')
}

export async function checkWrapperStatus(profileId: string): Promise<WrapperStatus> {
  return invoke('check_wrapper_status', { profileId })
}

// ============ Settings Commands ============

export async function getSettings(): Promise<AppSettings> {
  return invoke('get_settings')
}

export async function updateSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  return invoke('update_settings', { input })
}