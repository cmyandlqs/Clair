import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type Language = 'zh' | 'en'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

const translations: Record<Language, Record<string, string>> = {
  en: {
    // General
    'app.name': 'Clair',
    'app.tagline': 'Local Claude Provider Gateway',

    // Proxy Status
    'proxy.running': 'Proxy Running',
    'proxy.stopped': 'Proxy Stopped',
    'proxy.start': 'Start Proxy',
    'proxy.stop': 'Stop',

    // Providers
    'provider.add': 'Add Provider',
    'provider.edit': 'Edit Provider',
    'provider.delete': 'Delete',
    'provider.test': 'Test',
    'provider.createProfile': 'Create Profile',
    'provider.name': 'Name',
    'provider.baseUrl': 'Base URL',
    'provider.apiKey': 'API Key',
    'provider.authScheme': 'Auth Scheme',
    'provider.defaultModel': 'Default Model',
    'provider.notes': 'Notes',
    'provider.type': 'Provider Type',
    'provider.status': 'Status',
    'provider.lastTested': 'Last Tested',
    'provider.usedBy': 'Used by {count} profile',
    'provider.usedBy_plural': 'Used by {count} profiles',
    'provider.save': 'Save Provider',
    'provider.saved': 'Provider saved',
    'provider.deleteConfirm': 'Delete this provider?',
    'provider.deleteError': 'Cannot delete provider that is in use',
    'provider.connected': 'Connected! Latency: {latency}ms, Model: {model}',
    'provider.connectionFailed': 'Connection failed',
    'provider.noProviders': 'No providers yet',
    'provider.noProvidersHint': 'Add your first provider to start routing Claude Code locally.',

    // Provider Types
    'provider.type.anthropic': 'Anthropic-compatible',
    'provider.type.openai': 'OpenAI-compatible',
    'provider.type.custom': 'Custom',

    // Provider Status
    'status.ready': 'Ready',
    'status.untested': 'Untested',
    'status.error': 'Error',
    'status.disabled': 'Disabled',

    // Profiles
    'profile.profiles': 'Profiles',
    'profile.add': 'New Profile',
    'profile.edit': 'Edit Profile',
    'profile.delete': 'Delete',
    'profile.name': 'Profile Name',
    'profile.routePath': 'Route Path',
    'profile.command': 'Command',
    'profile.provider': 'Provider',
    'profile.model': 'Model',
    'profile.setDefault': 'Set as default profile',
    'profile.generateWrapper': 'Generate wrapper',
    'profile.create': 'Create Profile',
    'profile.save': 'Save Changes',
    'profile.created': 'Profile created',
    'profile.saved': 'Profile saved',
    'profile.deleted': 'Profile deleted',
    'profile.noProfiles': 'No profiles yet',
    'profile.noProfilesHint': 'Profiles create commands like claude-glm',
    'profile.copyCommand': 'Copy Command',
    'profile.regenerateWrapper': 'Regenerate Wrapper',
    'profile.details': 'Profile Details',
    'profile.generating': 'Generating...',

    // Detail Panel
    'detail.selectProfileOrProvider': 'Select a profile or provider',
    'detail.toSeeDetails': 'to see details',
    'provider.details': 'Provider Details',
    'detail.name': 'Name',
    'detail.route': 'Route',
    'detail.command': 'Command',
    'detail.provider': 'Provider',
    'detail.type': 'Type',
    'detail.authScheme': 'Auth Scheme',
    'detail.defaultModel': 'Default Model',
    'detail.lastTested': 'Last Tested',
    'detail.providerReady': 'Provider Ready',
    'detail.nextStep': 'Next step: Create a Profile to route requests through this provider',
    'detail.alreadyUsing': '{count} profile(s) already using this provider',
    'testConnection': 'Test Connection',
    'detail.testing': 'Testing...',
    'detail.copyCommand': 'Copy Command',
    'detail.regenerate': 'Regenerate Wrapper',
    'detail.generating': 'Generating...',
    'detail.createProfile': 'Create Profile',
    'detail.profileCount': '{count} profile',
    'detail.profileCount_plural': '{count} profiles',

    // Settings
    'settings.settings': 'Settings',
    'settings.general': 'General',
    'settings.theme': 'Theme',
    'settings.themeHint': 'Choose your preferred theme',
    'settings.startOnLogin': 'Start on login',
    'settings.startOnLoginHint': 'Launch Clair when you log in',
    'settings.proxy': 'Proxy',
    'settings.host': 'Host',
    'settings.port': 'Port',
    'settings.startProxyOnLaunch': 'Start proxy on launch',
    'settings.claudeCode': 'Claude Code',
    'settings.claudeBinaryPath': 'Claude Binary Path',
    'settings.wrapperDir': 'Wrapper Directory',
    'settings.data': 'Data',
    'settings.export': 'Export',
    'settings.import': 'Import',
    'settings.reset': 'Reset',
    'settings.language': 'Language',
    'settings.languageHint': 'Select interface language',
    'settings.save': 'Save',

    // Validation
    'validation.nameRequired': 'Name is required',
    'validation.baseUrlRequired': 'Base URL is required',
    'validation.invalidUrl': 'Invalid URL format',
    'validation.apiKeyRequired': 'API Key is required',
    'validation.modelRequired': 'Model is required',
    'validation.routeRequired': 'Route path is required',
    'validation.routeFormat': 'Route must start with / and contain only lowercase letters, numbers, - and _',
    'validation.routeReserved': 'This route path is reserved',
    'validation.commandRequired': 'Command name is required',
    'validation.commandFormat': 'Command name can only contain letters, numbers, - and _',
    'validation.commandDangerous': 'This command name is not allowed',
    'validation.selectProvider': 'Please select a provider',

    // Modal
    'modal.chooseType': 'Choose Provider Type',
    'modal.back': 'Back',
    'modal.cancel': 'Cancel',

    // Errors
    'error.connectionFailed': 'Could not connect to provider',
    'error.generic': 'An error occurred',

    // Notes
    'notes.optional': 'Notes (optional)',
  },
  zh: {
    // General
    'app.name': 'Clair',
    'app.tagline': '本地 Claude Provider 网关',

    // Proxy Status
    'proxy.running': '代理运行中',
    'proxy.stopped': '代理已停止',
    'proxy.start': '启动代理',
    'proxy.stop': '停止',

    // Providers
    'provider.add': '添加 Provider',
    'provider.edit': '编辑 Provider',
    'provider.delete': '删除',
    'provider.test': '测试',
    'provider.createProfile': '创建 Profile',
    'provider.name': '名称',
    'provider.baseUrl': 'Base URL',
    'provider.apiKey': 'API Key',
    'provider.authScheme': '认证方式',
    'provider.defaultModel': '默认模型',
    'provider.notes': '备注',
    'provider.type': 'Provider 类型',
    'provider.status': '状态',
    'provider.lastTested': '上次测试',
    'provider.usedBy': '被 {count} 个 Profile 使用',
    'provider.usedBy_plural': '被 {count} 个 Profile 使用',
    'provider.save': '保存 Provider',
    'provider.saved': 'Provider 已保存',
    'provider.deleteConfirm': '确定删除此 Provider？',
    'provider.deleteError': '无法删除正在使用的 Provider',
    'provider.connected': '连接成功！延迟：{latency}ms，模型：{model}',
    'provider.connectionFailed': '连接失败',
    'provider.noProviders': '暂无 Provider',
    'provider.noProvidersHint': '添加您的第一个 Provider 来开始路由 Claude Code。',

    // Provider Types
    'provider.type.anthropic': 'Anthropic 兼容',
    'provider.type.openai': 'OpenAI 兼容',
    'provider.type.custom': '自定义',

    // Provider Status
    'status.ready': '就绪',
    'status.untested': '未测试',
    'status.error': '错误',
    'status.disabled': '已禁用',

    // Profiles
    'profile.profiles': 'Profiles',
    'profile.add': '新建 Profile',
    'profile.edit': '编辑 Profile',
    'profile.delete': '删除',
    'profile.name': 'Profile 名称',
    'profile.routePath': '路由路径',
    'profile.command': '命令',
    'profile.provider': 'Provider',
    'profile.model': '模型',
    'profile.setDefault': '设为默认 Profile',
    'profile.generateWrapper': '生成 Wrapper',
    'profile.create': '创建 Profile',
    'profile.save': '保存更改',
    'profile.created': 'Profile 已创建',
    'profile.saved': 'Profile 已保存',
    'profile.deleted': 'Profile 已删除',
    'profile.noProfiles': '暂无 Profile',
    'profile.noProfilesHint': 'Profile 会创建 claude-glm 这样的命令',
    'profile.copyCommand': '复制命令',
    'profile.regenerateWrapper': '重新生成 Wrapper',
    'profile.details': 'Profile 详情',
    'profile.generating': '生成中...',

    // Detail Panel
    'detail.selectProfileOrProvider': '选择一个 Profile 或 Provider',
    'detail.toSeeDetails': '以查看详情',
    'provider.details': 'Provider 详情',
    'detail.name': '名称',
    'detail.route': '路由',
    'detail.command': '命令',
    'detail.provider': 'Provider',
    'detail.type': '类型',
    'detail.authScheme': '认证方式',
    'detail.defaultModel': '默认模型',
    'detail.lastTested': '上次测试',
    'detail.providerReady': 'Provider 就绪',
    'detail.nextStep': '下一步：创建 Profile 以通过此 Provider 路由请求',
    'detail.alreadyUsing': '已有 {count} 个 Profile 使用此 Provider',
    'testConnection': '测试连接',
    'detail.testing': '测试中...',
    'detail.copyCommand': '复制命令',
    'detail.regenerate': '重新生成 Wrapper',
    'detail.generating': '生成中...',
    'detail.createProfile': '创建 Profile',
    'detail.profileCount': '{count} 个 Profile',
    'detail.profileCount_plural': '{count} 个 Profile',

    // Settings
    'settings.settings': '设置',
    'settings.general': '通用',
    'settings.theme': '主题',
    'settings.themeHint': '选择偏好的主题',
    'settings.startOnLogin': '开机启动',
    'settings.startOnLoginHint': '登录时启动 Clair',
    'settings.proxy': '代理',
    'settings.host': '主机',
    'settings.port': '端口',
    'settings.startProxyOnLaunch': '启动时自动运行代理',
    'settings.claudeCode': 'Claude Code',
    'settings.claudeBinaryPath': 'Claude 路径',
    'settings.wrapperDir': 'Wrapper 目录',
    'settings.data': '数据',
    'settings.export': '导出',
    'settings.import': '导入',
    'settings.reset': '重置',
    'settings.language': '语言',
    'settings.languageHint': '选择界面语言',
    'settings.save': '保存',

    // Validation
    'validation.nameRequired': '名称不能为空',
    'validation.baseUrlRequired': 'Base URL 不能为空',
    'validation.invalidUrl': 'URL 格式无效',
    'validation.apiKeyRequired': 'API Key 不能为空',
    'validation.modelRequired': '模型不能为空',
    'validation.routeRequired': '路由路径不能为空',
    'validation.routeFormat': '路由必须以 / 开头，只能包含小写字母、数字、- 和 _',
    'validation.routeReserved': '此路由路径被保留',
    'validation.commandRequired': '命令名称不能为空',
    'validation.commandFormat': '命令只能包含字母、数字、- 和 _',
    'validation.commandDangerous': '此命令名称不允许使用',
    'validation.selectProvider': '请选择 Provider',

    // Modal
    'modal.chooseType': '选择 Provider 类型',
    'modal.back': '返回',
    'modal.cancel': '取消',

    // Errors
    'error.connectionFailed': '无法连接到 Provider',
    'error.generic': '发生错误',

    // Notes
    'notes.optional': '备注（可选）',
  },
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh')

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = translations[language][key] || translations['en'][key] || key
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v))
        })
      }
      return text
    },
    [language]
  )

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

export type { Language }
