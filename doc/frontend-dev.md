# Clair 前端开发文档

> 本文档基于 `doc/prd.md` 产品需求文档，定义 Clair 前端开发的具体实现细节。

---

## 1. 技术栈与项目结构

### 1.1 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Tailwind CSS | 3.x | 样式框架 |
| Framer Motion | 11.x | 动画 |
| Lucide React | latest | 图标库 |
| TanStack Query | 5.x | 服务端状态 |
| Zustand | 4.x | UI 状态管理 |
| Zod | 3.x | 表单校验 |
| @tauri-apps/api | 2.x | Tauri 通信 |

### 1.2 项目结构

```
src/
├── app/
│   ├── App.tsx              # 根组件
│   └── routes.tsx           # 路由配置
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx   # 三栏主布局
│   │   ├── TopBar.tsx       # 顶部栏
│   │   ├── Sidebar.tsx      # 侧边栏
│   │   └── DetailPanel.tsx  # 详情面板
│   ├── provider/
│   │   ├── ProviderCard.tsx       # Provider 卡片
│   │   ├── ProviderList.tsx       # Provider 列表
│   │   ├── AddProviderModal.tsx   # 添加 Provider 弹窗
│   │   └── EditProviderModal.tsx   # 编辑 Provider 弹窗
│   ├── profile/
│   │   ├── ProfileList.tsx        # Profile 列表
│   │   ├── ProfileItem.tsx        # Profile 单项
│   │   ├── AddProfileModal.tsx    # 添加 Profile 弹窗
│   │   └── EditProfileModal.tsx   # 编辑 Profile 弹窗
│   ├── settings/
│   │   └── SettingsModal.tsx      # 设置弹窗
│   └── common/
│       ├── Button.tsx       # 按钮组件
│       ├── Input.tsx        # 输入框组件
│       ├── Select.tsx       # 选择框组件
│       ├── Modal.tsx        # 弹窗基础组件
│       ├── Toast.tsx        # Toast 提示
│       └── Badge.tsx        # 状态徽章
├── hooks/
│   ├── useProviders.ts      # Provider 数据 hook
│   ├── useProfiles.ts       # Profile 数据 hook
│   ├── useProxyStatus.ts    # 代理状态 hook
│   ├── useSettings.ts      # 设置 hook
│   └── useToast.ts          # Toast hook
├── lib/
│   ├── api.ts               # Tauri 命令封装
│   ├── types.ts             # 类型定义
│   └── validators.ts        # Zod 校验模式
├── styles/
│   └── globals.css          # 全局样式 & CSS 变量
└── main.tsx                 # 入口文件
```

---

## 2. 类型定义

### 2.1 核心类型

```typescript
// src/lib/types.ts

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
```

---

## 3. API 封装

### 3.1 Tauri Command 封装

```typescript
// src/lib/api.ts

import { invoke } from '@tauri-apps/api/core'

// ============ Provider Commands ============

export async function listProviders(): Promise<Provider[]> {
  return invoke('list_providers')
}

export async function createProvider(input: CreateProviderInput): Promise<Provider> {
  return invoke('create_provider', { input })
}

export async function updateProvider(input: UpdateProviderInput): Promise<Provider> {
  return invoke('update_provider', { input })
}

export async function deleteProvider(id: string): Promise<{ success: boolean }> {
  return invoke('delete_provider', { id })
}

export async function testProvider(id: string): Promise<TestProviderResult> {
  return invoke('test_provider', { id })
}

// ============ Profile Commands ============

export async function listProfiles(): Promise<Profile[]> {
  return invoke('list_profiles')
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  return invoke('create_profile', { input })
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  return invoke('update_profile', { input })
}

export async function deleteProfile(id: string): Promise<{ success: boolean }> {
  return invoke('delete_profile', { id })
}

export async function setDefaultProfile(id: string): Promise<Profile> {
  return invoke('set_default_profile', { id })
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

// ============ Types for API ============

export type CreateProviderInput = {
  name: string
  type: ProviderType
  baseUrl: string
  apiKey: string
  authScheme: AuthScheme
  defaultModel: string
  enableStreaming: boolean
  notes?: string
}

export type UpdateProviderInput = {
  id: string
  name?: string
  baseUrl?: string
  apiKey?: string
  authScheme?: AuthScheme
  defaultModel?: string
  enableStreaming?: boolean
  notes?: string
  status?: ProviderStatus
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

export type ClaudeBinaryDetection = {
  found: boolean
  path?: string
  candidates: string[]
}

export type GenerateWrapperResult = {
  success: boolean
  path: string
  commandName: string
}
```

---

## 4. 表单校验

### 4.1 Provider 校验

```typescript
// src/lib/validators.ts

import { z } from 'zod'

export const providerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  type: z.enum(['anthropic_compatible', 'openai_compatible', 'custom']),
  baseUrl: z.string().min(1, 'Base URL is required').url('Invalid URL format'),
  apiKey: z.string().min(1, 'API Key is required'),
  authScheme: z.enum(['x_api_key', 'bearer']),
  defaultModel: z.string().min(1, 'Default model is required'),
  enableStreaming: z.boolean().default(true),
  notes: z.string().max(500).optional(),
})

export const updateProviderSchema = providerSchema.partial()

export type ProviderFormData = z.infer<typeof providerSchema>
```

### 4.2 Profile 校验

```typescript
// src/lib/validators.ts (continued)

export const RESERVED_ROUTES = ['/health', '/status', '/api', '/admin', '/logs']

export const DANGEROUS_COMMANDS = [
  'bash', 'sh', 'sudo', 'rm', 'cp', 'mv', 'python', 'node', 'npm', 
  'git', 'docker', 'kubectl', 'aws', 'gcloud', 'cargo', 'go', 'java'
]

export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  routePath: z.string()
    .min(1, 'Route path is required')
    .regex(/^\/[a-z0-9_-]+$/, 'Route must start with / and contain only lowercase letters, numbers, - and _')
    .refine(path => !RESERVED_ROUTES.includes(path), {
      message: 'This route path is reserved'
    }),
  providerId: z.string().min(1, 'Please select a provider'),
  model: z.string().min(1, 'Model is required'),
  commandName: z.string()
    .min(1, 'Command name is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Command name can only contain letters, numbers, - and _')
    .refine(cmd => !DANGEROUS_COMMANDS.includes(cmd.toLowerCase()), {
      message: 'This command name is not allowed'
    }),
  isDefault: z.boolean().default(false),
  wrapperEnabled: z.boolean().default(true),
})

export const updateProfileSchema = profileSchema.partial()

export type ProfileFormData = z.infer<typeof profileSchema>
```

---

## 5. 状态管理

### 5.1 服务端数据 (TanStack Query)

```typescript
// src/hooks/useProviders.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  listProviders, 
  createProvider, 
  updateProvider, 
  deleteProvider,
  testProvider 
} from '@/lib/api'
import type { CreateProviderInput, UpdateProviderInput } from '@/lib/api'

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (input: CreateProviderInput) => createProvider(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}

export function useUpdateProvider() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProviderInput & { id: string }) => 
      updateProvider({ id, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}

export function useDeleteProvider() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}

export function useTestProvider() {
  return useMutation({
    mutationFn: (id: string) => testProvider(id),
  })
}
```

### 5.2 Profile Hooks

```typescript
// src/hooks/useProfiles.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  listProfiles, 
  createProfile, 
  updateProfile, 
  deleteProfile,
  setDefaultProfile 
} from '@/lib/api'
import type { CreateProfileInput, UpdateProfileInput } from '@/lib/api'

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
  })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (input: CreateProfileInput) => createProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProfileInput & { id: string }) => 
      updateProfile({ id, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

export function useSetDefaultProfile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => setDefaultProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
```

### 5.3 Proxy Status Hook

```typescript
// src/hooks/useProxyStatus.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getProxyStatus, 
  startProxy, 
  stopProxy,
  restartProxy 
} from '@/lib/api'

export function useProxyStatus() {
  return useQuery({
    queryKey: ['proxyStatus'],
    queryFn: getProxyStatus,
    refetchInterval: 5000, // 每 5 秒刷新状态
  })
}

export function useStartProxy() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: () => startProxy(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] })
    },
  })
}

export function useStopProxy() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: () => stopProxy(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] })
    },
  })
}

export function useRestartProxy() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: () => restartProxy(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] })
    },
  })
}
```

### 5.4 UI 状态 (Zustand)

```typescript
// src/hooks/useUIStore.ts

import { create } from 'zustand'

type ModalType = 'addProvider' | 'editProvider' | 'addProfile' | 'editProfile' | 'settings' | null

interface UIState {
  // 选择状态
  selectedProviderId: string | null
  selectedProfileId: string | null
  
  // Modal 状态
  activeModal: ModalType
  
  // 动作
  selectProvider: (id: string | null) => void
  selectProfile: (id: string | null) => void
  openModal: (modal: ModalType) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedProviderId: null,
  selectedProfileId: null,
  activeModal: null,
  
  selectProvider: (id) => set({ selectedProviderId: id, selectedProfileId: null }),
  selectProfile: (id) => set({ selectedProfileId: id, selectedProviderId: null }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}))
```

---

## 6. 组件实现

### 6.0 设计风格与美学

本章节基于 UI 参考图（[参考1](UI参考/ChatGPT%20Image%202026年5月17日%2018_13_41%20(1).png)、[参考2](UI参考/ChatGPT%20Image%202026年5月17日%2018_13_42%20(2).png)、[参考3](UI参考/ChatGPT%20Image%202026年5月17日%2018_13_43%20(3).png)、[参考4](UI参考/ChatGPT%20Image%202026年5月17日%2018_13_43%20(4).png)）定义的 Clair UI 设计规范。

#### 6.0.1 设计理念："Professional Warmth"

Clair UI 追求"专业温暖"的设计风格，融合 macOS 原生设计模式与定制化的温暖品牌调性。设计避免典型 LLM 工具的"Hackery"审美，转而呈现高端生产力 SaaS 产品（类 Linear/Raycast）的精致感。

核心理念：
- **桌面原生感**：使用标准 macOS 窗口控件、"⌘K" 搜索快捷键，让用户感觉应用与 OS 无缝集成
- **清晰度优先**：用白底橙色点缀的设计，将"代理网关"和"包装器"等技术复杂性隐藏在干净、易接近的界面下
- **温暖精致**：使用暖色调配色方案，与众不同地呈现为明亮、通风、高对比度的浅色模式

#### 6.0.2 色彩系统

```css
/* src/styles/globals.css - 完整色彩系统 */

:root {
  /* ========== 背景层 ========== */
  --background: #F9F9F9;        /* 主应用背景 - 非常浅的暖灰 */
  --background-subtle: #F3F3F3; /* 侧边栏/次要背景 */
  --canvas: #FDFBFA;           /* 画布色 - 非常温暖的米白 */
  
  /* ========== 表面层（卡片/面板） ========== */
  --surface: #FFFFFF;          /* 纯白卡片表面 */
  --surface-elevated: #FFFFFF; /* 浮起表面 */
  --surface-muted: #F5F5F5;   /* 柔和表面 - 用于内嵌代码背景 */
  
  /* ========== 主色调 (Orange/Coral) ========== */
  --primary: #E67E50;          /* 设计师橙 - 主 CTA、Logo */
  --primary-hover: #D66A3A;    /* 主色悬停态 */
  --primary-active: #C85A2A;    /* 主色激活态 */
  --primary-soft: #FFF0E8;     /* 柔和橙 - 用于选中态背景 */
  --primary-border: #FFCDB8;   /* 主色边框（选中态） */
  
  /* ========== 语义色 ========== */
  --success: #52C41A;          /* 成功绿 */
  --success-soft: #F6FFED;     /* 成功背景 */
  --warning: #FAAD14;          /* 警告黄 */
  --warning-soft: #FFFBE6;     /* 警告背景 */
  --error: #FF4D4F;            /* 错误红 */
  --error-soft: #FFF1F0;       /* 错误背景 */
  --info: #1890FF;             /* 信息蓝 */
  
  /* ========== 文字层 ========== */
  --text-primary: #1A1A1A;     /* 主文字 - 深炭黑 */
  --text-secondary: #666666;    /* 次要文字 - 中灰 */
  --text-muted: #999999;       /* 占位符/禁用文字 */
  --text-hint: #A0A0A0;        /* 提示文字 */
  
  /* ========== 边框层 ========== */
  --border: #EDEDED;           /* 默认边框 */
  --border-strong: #E0E0E0;   /* 强调边框 */
  --border-active: #E67E50;    /* 选中边框 */
  
  /* ========== 阴影 ========== */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);   /* 微阴影 */
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.06);   /* 中等阴影 */
  --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.08); /* 大阴影（模态框） */
  --shadow-inner: inset 0 1px 2px rgba(0, 0, 0, 0.04); /* 内阴影 */
}
```

**语义色使用规范**：
- **Green (`#52C41A`)**：用于"Running"、"Online"、"200 OK"状态
- **Yellow (`#FAAD14`)**：用于"429"限流状态
- **Soft Variants**：浅色背景（如 `#F6FFED`）配合深色文字/图标

#### 6.0.3 字体系统

```css
/* 字体族栈 */
font-family: 
  -apple-system,              /* macOS San Francisco */
  BlinkMacSystemFont,          /* Chrome on macOS */
  "SF Pro Display",           /* Windows 仿 SF */
  "Inter",                     /* 跨平台备选 */
  "PingFang SC",              /* 中文优化 */
  system-ui,                  /* 系统 UI */
  sans-serif;

/* 字体层级 */
.text-logo {
  font-family: "Playfair Display", Georgia, serif; /* Logo 使用衬线体 */
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.text-title {
  font-size: 18px;
  font-weight: 600; /* Semibold */
  line-height: 1.4;
}

.text-heading {
  font-size: 15-16px;
  font-weight: 600;
  color: var(--text-primary);
}

.text-body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-secondary);
}

.text-small {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.text-mono {
  font-family: "SF Mono", "JetBrains Mono", "Consolas", monospace;
  font-size: 12-13px;
}
```

#### 6.0.4 布局结构

```
┌─────────────────────────────────────────────────────────────────┐
│  Top Bar: [≡] Clair              [⌘K] [Status ●] [+Add] [⚙]   │
├──────────┬──────────────────────────────┬──────────────────────┤
│ Sidebar │                            │                      │
│  240px  │     Provider Cards         │   Detail Panel       │
│          │        (Grid)             │      320px           │
│ Profiles│                            │                      │
│          │  ┌────────┐ ┌────────┐   │  Profile/Provider    │
│ ──────── │  │ Zhipu  │ │ MiniMax│   │    Details           │
│          │  │  GLM   │ │        │   │                      │
│ Stats    │  └────────┘ └────────┘   │  - Route URL         │
│ Logs     │                            │  - Command           │
│ Help     │  ┌────────┐ ┌────────┐   │  - Model             │
│          │  │ DeepSeek│ │Custom  │   │  - Actions           │
│ ──────── │  └────────┘ └────────┘   │                      │
│ v0.1.0   │                            │                      │
└──────────┴──────────────────────────────┴──────────────────────┘
```

**间距系统（8px 基准网格）**：
- 页面外边距：`24px`
- 侧边栏与内容间距：`20px`
- 卡片间距（gutter）：`16px`
- 卡片内部边距：`20px`
- 表单字段间距：`16px`

#### 6.0.5 组件样式规范

**卡片 (Card)**：
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px; /* 大组件 12-16px */
  padding: 20px;
  box-shadow: var(--shadow-sm); /* 微阴影提供轻微深度 */
  transition: all 0.15s ease-out;
}

.card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px); /* 微上浮 */
}

.card.selected {
  border: 2px solid var(--primary);
  background: var(--primary-soft); /* 柔和橙背景 */
}
```

**按钮 (Button)**：
```css
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 8px 16px;
  border-radius: 8px; /* 小元素 6-8px */
  font-weight: 500;
  transition: all 0.15s ease-out;
}

.btn-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.btn-primary:active {
  background: var(--primary-active);
  transform: scale(0.98);
}

.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 8px;
}

.btn-secondary:hover {
  background: var(--surface-muted);
  border-color: var(--border-strong);
}

.btn-ghost {
  /* 用于次要操作，无边框 */
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 12px;
}
```

**输入框 (Input)**：
```css
.input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 14px;
  transition: all 0.15s ease-out;
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.input::placeholder {
  color: var(--text-muted);
}
```

**徽章/标签 (Badge)**：
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 20px; /* 胶囊形态 */
  font-size: 12px;
  font-weight: 500;
}

.badge-success {
  background: var(--success-soft);
  color: var(--success);
}

.badge-warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.badge-primary {
  background: var(--primary-soft);
  color: var(--primary);
}
```

**侧边栏项目**：
```css
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: all 0.15s ease-out;
}

.sidebar-item:hover {
  background: var(--surface-muted);
}

.sidebar-item.active {
  background: var(--primary-soft);
  color: var(--primary);
}

.sidebar-item .icon {
  width: 18px;
  height: 18px;
  stroke-width: 1.5; /* 细线图标 */
}
```

#### 6.0.6 动效规范

```css
/* 全局过渡 */
* {
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

/* 模态框动画 */
.modal-enter {
  opacity: 0;
  transform: scale(0.95);
}
.modal-enter-active {
  opacity: 1;
  transform: scale(1);
  transition: all 150ms ease-out;
}

/* 卡片悬停上浮 */
.card {
  transition: transform 150ms ease-out, 
              box-shadow 150ms ease-out,
              border-color 150ms ease-out;
}

.card:hover {
  transform: translateY(-2px);
}

/* 按钮点击缩放 */
.btn:active {
  transform: scale(0.98);
}

/* 侧边栏项目滑动 */
.sidebar-item {
  transition: background 150ms ease-out, 
              color 150ms ease-out,
              transform 150ms ease-out;
}

.sidebar-item:hover {
  transform: translateX(2px);
}
```

#### 6.0.7 图标风格

图标使用 **1.5-2pt 描边细线图标**（Lucide React 默认）：
- 颜色：默认灰色（`var(--text-muted)`），激活时使用主色
- 大小：16x16px（导航）、20x20px（操作）、24x24px（状态）
- 不使用填充图标，保持极简感

**Provider 品牌图标**：使用彩色品牌图标（Claude 蓝、GLM 橙、MiniMax 绿等）辅助快速识别。

#### 6.0.8 设计细节总结

| 元素 | 规格 |
|------|------|
| 圆角-大容器/模态 | 16px |
| 圆角-卡片 | 12px |
| 圆角-按钮/输入框 | 6-8px |
| 圆角-徽章/标签 | 20px (胶囊) |
| 边框-默认 | 1px solid #EDEDED |
| 边框-选中 | 2px solid #E67E50 |
| 阴影-卡片 | 0 2px 8px rgba(0,0,0,0.04) |
| 阴影-模态 | 0 10px 30px rgba(0,0,0,0.08) |
| 内边距-卡片 | 20px |
| 内边距-模态内容 | 24px |
| 外边距-页面 | 24px |
| 图标描边 | 1.5px |

### 6.1 全局样式

```css
/* src/styles/globals.css */

/* Clair Design System - 基于 UI 参考图的完整样式系统 */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ========== 背景层 ========== */
    --background: #F9F9F9;
    --background-subtle: #F3F3F3;
    --canvas: #FDFBFA;
    
    /* ========== 表面层 ========== */
    --surface: #FFFFFF;
    --surface-elevated: #FFFFFF;
    --surface-muted: #F5F5F5;
    
    /* ========== 主色调 (Orange/Coral) ========== */
    --primary: #E67E50;
    --primary-hover: #D66A3A;
    --primary-active: #C85A2A;
    --primary-soft: #FFF0E8;
    --primary-border: #FFCDB8;
    
    /* ========== 语义色 ========== */
    --success: #52C41A;
    --success-soft: #F6FFED;
    --warning: #FAAD14;
    --warning-soft: #FFFBE6;
    --error: #FF4D4F;
    --error-soft: #FFF1F0;
    --info: #1890FF;
    
    /* ========== 文字层 ========== */
    --text-primary: #1A1A1A;
    --text-secondary: #666666;
    --text-muted: #999999;
    --text-hint: #A0A0A0;
    
    /* ========== 边框层 ========== */
    --border: #EDEDED;
    --border-strong: #E0E0E0;
    --border-active: #E67E50;
    
    /* ========== 阴影 ========== */
    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.08);
    --shadow-inner: inset 0 1px 2px rgba(0, 0, 0, 0.04);
  }
  
  html, body {
    @apply bg-[var(--background)] text-[var(--text-primary)] font-sans antialiased;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  /* ========== 卡片 ========== */
  .card {
    @apply bg-[var(--surface)] rounded-xl border border-[var(--border)] 
           transition-all duration-150 ease-out;
    box-shadow: var(--shadow-sm);
  }
  
  .card:hover {
    @apply border-[var(--border-strong)];
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  
  .card.selected {
    @apply border-2 border-[var(--primary)];
    background: var(--primary-soft);
  }
  
  /* ========== 按钮 ========== */
  .btn-primary {
    @apply px-4 py-2 bg-[var(--primary)] text-white rounded-lg font-medium;
    transition: all 0.15s ease-out;
  }
  
  .btn-primary:hover {
    @apply bg-[var(--primary-hover)];
    transform: translateY(-1px);
  }
  
  .btn-primary:active {
    @apply bg-[var(--primary-active)] scale-[0.98];
  }
  
  .btn-secondary {
    @apply px-4 py-2 bg-transparent text-[var(--text-secondary)] rounded-lg 
           border border-[var(--border)] font-medium;
    transition: all 0.15s ease-out;
  }
  
  .btn-secondary:hover {
    @apply bg-[var(--surface-muted)] border-[var(--border-strong)];
  }
  
  .btn-ghost {
    @apply px-3 py-2 bg-transparent text-[var(--text-secondary)] rounded-lg
           font-medium transition-colors duration-150;
  }
  
  .btn-ghost:hover {
    @apply bg-[var(--surface-muted)];
  }
  
  /* ========== 输入框 ========== */
  .input {
    @apply w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] 
           rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
           transition-all duration-150;
  }
  
  .input:focus {
    @apply outline-none border-[var(--primary)];
    box-shadow: 0 0 0 3px var(--primary-soft);
  }
  
  .label {
    @apply block text-sm font-medium text-[var(--text-primary)] mb-1.5;
  }
  
  /* ========== 徽章 ========== */
  .badge {
    @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium;
  }
  
  .badge-success {
    @apply bg-[var(--success-soft)] text-[var(--success)];
  }
  
  .badge-warning {
    @apply bg-[var(--warning-soft)] text-[var(--warning)];
  }
  
  .badge-error {
    @apply bg-[var(--error-soft)] text-[var(--error)];
  }
  
  .badge-primary {
    @apply bg-[var(--primary-soft)] text-[var(--primary)];
  }
  
  /* ========== 侧边栏项 ========== */
  .sidebar-item {
    @apply flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--text-secondary)]
           transition-all duration-150 cursor-pointer;
  }
  
  .sidebar-item:hover {
    @apply bg-[var(--surface-muted)] text-[var(--text-primary)];
    transform: translateX(2px);
  }
  
  .sidebar-item.active {
    @apply bg-[var(--primary-soft)] text-[var(--primary)];
  }
  
  .sidebar-item .icon {
    @apply w-4 h-4;
    stroke-width: 1.5;
  }
}
```

### 6.2 MainLayout 组件

```tsx
// src/components/layout/MainLayout.tsx

import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { ProviderList } from '../provider/ProviderList'
import { DetailPanel } from './DetailPanel'
import { AddProviderModal } from '../provider/AddProviderModal'
import { AddProfileModal } from '../profile/AddProfileModal'
import { SettingsModal } from '../settings/SettingsModal'
import { Toast } from '../common/Toast'
import { useUIStore } from '@/hooks/useUIStore'

export function MainLayout() {
  const { activeModal, closeModal } = useUIStore()
  
  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      <TopBar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧: Profiles Sidebar */}
        <Sidebar />
        
        {/* 中间: Provider Cards Grid */}
        <main className="flex-1 overflow-auto p-6 bg-[var(--background)]">
          <ProviderList />
        </main>
        
        {/* 右侧: Detail Panel */}
        <DetailPanel />
      </div>
      
      {/* Modals - AnimatePresence for smooth transitions */}
      <AnimatePresence>
        {activeModal === 'addProvider' && (
          <AddProviderModal onClose={closeModal} />
        )}
        {activeModal === 'addProfile' && (
          <AddProfileModal onClose={closeModal} />
        )}
        {activeModal === 'settings' && (
          <SettingsModal onClose={closeModal} />
        )}
      </AnimatePresence>
      
      <Toast />
    </div>
  )
}
```

### 6.3 TopBar 组件

```tsx
// src/components/layout/TopBar.tsx

import { Settings, Play, Square, Search } from 'lucide-react'
import { useProxyStatus, useStartProxy, useStopProxy } from '@/hooks/useProxyStatus'
import { useUIStore } from '@/hooks/useUIStore'

export function TopBar() {
  const { openModal } = useUIStore()
  const { data: status } = useProxyStatus()
  const startProxyMutation = useStartProxy()
  const stopProxyMutation = useStopProxy()
  
  const isRunning = status?.running
  
  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--surface)] 
                      flex items-center justify-between px-6">
      {/* Left: Branding */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
          Clair
        </h1>
        <span className="text-sm text-[var(--text-muted)] hidden sm:inline">
          Local Claude Provider Gateway
        </span>
      </div>
      
      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search hint */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)]
                       text-sm text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors">
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">⌘K</span>
        </button>
        
        {/* Proxy Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-muted)]">
          <span className={`w-2 h-2 rounded-full ${
            isRunning ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'
          }`} />
          <span className="text-sm font-medium">
            {isRunning ? 'Proxy Running' : 'Proxy Stopped'}
          </span>
        </div>
        
        {/* Proxy Control */}
        {isRunning ? (
          <button
            onClick={() => stopProxyMutation.mutate()}
            disabled={stopProxyMutation.isPending}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        ) : (
          <button
            onClick={() => startProxyMutation.mutate()}
            disabled={startProxyMutation.isPending}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Play className="w-3.5 h-3.5" />
            Start Proxy
          </button>
        )}
        
        {/* Add Provider */}
        <button
          onClick={() => openModal('addProvider')}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <span className="text-lg leading-none">+</span>
          Add Provider
        </button>
        
        {/* Settings */}
        <button
          onClick={() => openModal('settings')}
          className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
        >
          <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
      </div>
    </header>
  )
}
```

### 6.4 Sidebar 组件

```tsx
// src/components/layout/Sidebar.tsx

import { motion } from 'framer-motion'
import { Plus, Cpu } from 'lucide-react'
import { useProfiles } from '@/hooks/useProfiles'
import { useProviders } from '@/hooks/useProviders'
import { useUIStore } from '@/hooks/useUIStore'

export function Sidebar() {
  const { data: profiles = [] } = useProfiles()
  const { data: providers = [] } = useProviders()
  const { selectedProfileId, selectProfile, openModal } = useUIStore()
  
  const getProviderName = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.name ?? 'Unknown'
  }
  
  return (
    <aside className="w-[240px] border-r border-[var(--border)] bg-[var(--background-subtle)] 
                      flex flex-col overflow-hidden">
      <div className="p-4 border-b border-[var(--border)]">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Profiles
        </h2>
      </div>
      
      <div className="flex-1 overflow-auto p-3">
        {profiles.length === 0 ? (
          <div className="text-center py-8">
            <Cpu className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No profiles yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Profiles create commands like claude-glm
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {profiles.map((profile) => (
              <motion.button
                key={profile.id}
                onClick={() => selectProfile(profile.id)}
                className={`sidebar-item w-full ${selectedProfileId === profile.id ? 'active' : ''}`}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2">
                  {profile.isDefault && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                  )}
                  <span className="font-medium truncate">{profile.name}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {profile.commandName} · {getProviderName(profile.providerId)}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-[var(--border)]">
        <button
          onClick={() => openModal('addProfile')}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Profile
        </button>
      </div>
    </aside>
  )
}
```

### 6.5 ProviderCard 组件

```tsx
// src/components/provider/ProviderCard.tsx

import { motion } from 'framer-motion'
import { TestTube, Pencil, Plus, ExternalLink } from 'lucide-react'
import type { Provider } from '@/lib/types'
import { Badge } from '../common/Badge'

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
  return (
    <motion.button
      onClick={onSelect}
      className={`card w-full text-left ${selected ? 'selected' : ''}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold ${
            provider.type === 'anthropic_compatible' ? 'bg-blue-100 text-blue-600' :
            provider.type === 'openai_compatible' ? 'bg-green-100 text-green-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {provider.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">{provider.name}</h3>
            <p className="text-xs text-[var(--text-muted)] font-mono">{provider.baseUrl}</p>
          </div>
        </div>
        <Badge status={provider.status} />
      </div>
      
      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] mb-4">
        <span>Model: {provider.defaultModel}</span>
        <span className="text-[var(--border)]">·</span>
        <span>Used by {profileCount} profile{profileCount !== 1 ? 's' : ''}</span>
      </div>
      
      <div className="flex items-center gap-1 pt-3 border-t border-[var(--border)]">
        <button
          onClick={(e) => { e.stopPropagation(); onTest(); }}
          className="btn-ghost p-2"
          title="Test connection"
        >
          <TestTube className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="btn-ghost p-2"
          title="Edit provider"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onCreateProfile(); }}
          className="btn-ghost p-2"
          title="Create profile"
        >
          <Plus className="w-4 h-4" />
        </button>
        <a
          href={provider.baseUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="btn-ghost p-2 ml-auto"
          title="Open URL"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </motion.button>
  )
}
```

### 6.6 Badge 组件

```tsx
// src/components/common/Badge.tsx

import type { ProviderStatus } from '@/lib/types'

interface BadgeProps {
  status: ProviderStatus
}

const statusConfig: Record<ProviderStatus, { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'badge badge-success' },
  untested: { label: 'Untested', className: 'badge badge-warning' },
  error: { label: 'Error', className: 'badge badge-error' },
  disabled: { label: 'Disabled', className: 'badge bg-gray-100 text-gray-500' },
}

export function Badge({ status }: BadgeProps) {
  const config = statusConfig[status]
  
  return (
    <span className={config.className}>
      {config.label}
    </span>
  )
}
```

### 6.7 DetailPanel 组件

```tsx
// src/components/layout/DetailPanel.tsx

import { Copy, RefreshCw, Play, FileCode } from 'lucide-react'
import { useProviders } from '@/hooks/useProviders'
import { useProfiles } from '@/hooks/useProfiles'
import { useProxyStatus } from '@/hooks/useProxyStatus'
import { useUIStore } from '@/hooks/useUIStore'
import { Badge } from '../common/Badge'

export function DetailPanel() {
  const { selectedProfileId, selectedProviderId } = useUIStore()
  const { data: providers = [] } = useProviders()
  const { data: profiles = [] } = useProfiles()
  const { data: proxyStatus } = useProxyStatus()
  
  const selectedProfile = profiles.find(p => p.id === selectedProfileId)
  const selectedProvider = providers.find(p => p.id === selectedProviderId)
  
  if (!selectedProfile && !selectedProvider) {
    return (
      <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] 
                        flex items-center justify-center">
        <div className="text-center text-[var(--text-muted)]">
          <FileCode className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a profile or provider</p>
          <p className="text-xs mt-1">to see details</p>
        </div>
      </aside>
    )
  }
  
  if (selectedProfile) {
    const provider = providers.find(p => p.id === selectedProfile.providerId)
    const baseUrl = proxyStatus?.running 
      ? `http://${proxyStatus.host}:${proxyStatus.port}${selectedProfile.routePath}`
      : 'Proxy not running'
    
    return (
      <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] overflow-auto">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold">Profile Details</h2>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="label">Name</label>
            <p className="text-lg font-medium">{selectedProfile.name}</p>
          </div>
          
          <div>
            <label className="label">Route</label>
            <p className="font-mono text-sm bg-[var(--surface-muted)] px-3 py-2 rounded-lg">
              {baseUrl}
            </p>
          </div>
          
          <div>
            <label className="label">Command</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-[var(--surface-muted)] px-3 py-2 rounded-lg">
                {selectedProfile.commandName}
              </code>
              <button className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div>
            <label className="label">Provider</label>
            <p>{provider?.name ?? 'Unknown'} · {selectedProfile.model}</p>
          </div>
          
          <div className="pt-4 border-t border-[var(--border)]">
            <button className="w-full btn-primary flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              Copy Command
            </button>
            <button className="w-full btn-secondary mt-2 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Regenerate Wrapper
            </button>
          </div>
        </div>
      </aside>
    )
  }
  
  if (selectedProvider) {
    return (
      <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] overflow-auto">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold">Provider Details</h2>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 
                          flex items-center justify-center text-[var(--primary)] font-semibold">
              {selectedProvider.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{selectedProvider.name}</p>
              <Badge status={selectedProvider.status} />
            </div>
          </div>
          
          <div>
            <label className="label">Base URL</label>
            <p className="font-mono text-sm">{selectedProvider.baseUrl}</p>
          </div>
          
          <div>
            <label className="label">Type</label>
            <p>{selectedProvider.type}</p>
          </div>
          
          <div>
            <label className="label">Auth Scheme</label>
            <p>{selectedProvider.authScheme}</p>
          </div>
          
          <div>
            <label className="label">Default Model</label>
            <p>{selectedProvider.defaultModel}</p>
          </div>
          
          {selectedProvider.lastTestedAt && (
            <div>
              <label className="label">Last Tested</label>
              <p className="text-sm text-[var(--text-muted)]">
                {new Date(selectedProvider.lastTestedAt).toLocaleString()}
              </p>
            </div>
          )}
          
          <div className="pt-4 border-t border-[var(--border)]">
            <button className="w-full btn-primary flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              Test Connection
            </button>
          </div>
        </div>
      </aside>
    )
  }
  
  return null
}
```

### 6.8 AddProviderModal 组件

```tsx
// src/components/provider/AddProviderModal.tsx

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, TestTube } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zodifier'
import { providerSchema, type ProviderFormData } from '@/lib/validators'
import { useCreateProvider, useTestProvider } from '@/hooks/useProviders'
import { useProviders } from '@/hooks/useProviders'

interface AddProviderModalProps {
  onClose: () => void
}

const PROVIDER_TYPES = [
  { value: 'anthropic_compatible', label: 'Anthropic-compatible', experimental: false },
  { value: 'openai_compatible', label: 'OpenAI-compatible', experimental: true },
  { value: 'custom', label: 'Custom', experimental: false },
] as const

export function AddProviderModal({ onClose }: AddProviderModalProps) {
  const [step, setStep] = useState(1)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  
  const createProvider = useCreateProvider()
  const testProvider = useTestProvider()
  const { data: providers = [] } = useProviders()
  
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      type: 'anthropic_compatible',
      authScheme: 'x_api_key',
      enableStreaming: true,
    },
  })
  
  const selectedType = watch('type')
  
  const onSubmit = async (data: ProviderFormData) => {
    try {
      await createProvider.mutateAsync(data)
      onClose()
    } catch (error) {
      console.error('Failed to create provider:', error)
    }
  }
  
  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    
    // 先保存 provider，然后测试
    const formData = watch()
    try {
      const result = await testProvider.mutateAsync(formData as any)
      setTestResult(result.ok 
        ? `Connected! Latency: ${result.latencyMs}ms, Model: ${result.model}`
        : `Failed: ${result.message}`
      )
    } catch (error) {
      setTestResult('Connection test failed')
    } finally {
      setIsTesting(false)
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
        transition={{ duration: 0.15 }}
        className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">
            {step === 1 ? 'Choose Provider Type' : 'Add Provider'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6">
            {step === 1 && (
              <div className="space-y-3">
                {PROVIDER_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setValue('type', type.value)
                      setStep(2)
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedType === type.value
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                        : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{type.label}</p>
                        {type.experimental && (
                          <span className="text-xs text-[var(--warning)]">Experimental</span>
                        )}
                      </div>
                      {selectedType === type.value && (
                        <div className="w-5 h-5 rounded-full bg-[var(--primary)]" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="label">Name</label>
                  <input {...register('name')} className="input" placeholder="Zhipu GLM" />
                  {errors.name && <p className="text-sm text-[var(--error)] mt-1">{errors.name.message}</p>}
                </div>
                
                <div>
                  <label className="label">Base URL</label>
                  <input {...register('baseUrl')} className="input" placeholder="https://api.example.com" />
                  {errors.baseUrl && <p className="text-sm text-[var(--error)] mt-1">{errors.baseUrl.message}</p>}
                </div>
                
                <div>
                  <label className="label">API Key</label>
                  <input {...register('apiKey')} type="password" className="input" />
                  {errors.apiKey && <p className="text-sm text-[var(--error)] mt-1">{errors.apiKey.message}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Auth Scheme</label>
                    <select {...register('authScheme')} className="input">
                      <option value="x_api_key">x-api-key</option>
                      <option value="bearer">Bearer</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Default Model</label>
                    <input {...register('defaultModel')} className="input" placeholder="glm-4" />
                  </div>
                </div>
                
                <div>
                  <label className="label">Notes (optional)</label>
                  <textarea {...register('notes')} className="input" rows={2} />
                </div>
                
                {/* Test Result */}
                {testResult && (
                  <div className={`p-3 rounded-lg text-sm ${
                    testResult.startsWith('Connected') 
                      ? 'bg-[var(--success)]/10 text-[var(--success)]'
                      : 'bg-[var(--error)]/10 text-[var(--error)]'
                  }`}>
                    {testResult}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-[var(--border)]">
            <div>
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary"
                >
                  Back
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {step === 2 && (
                <>
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={isTesting}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <TestTube className="w-4 h-4" />
                    {isTesting ? 'Testing...' : 'Test'}
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Provider
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
```

### 6.9 AddProfileModal 组件

```tsx
// src/components/profile/AddProfileModal.tsx

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zodifier'
import { profileSchema, type ProfileFormData } from '@/lib/validators'
import { useCreateProfile } from '@/hooks/useProfiles'
import { useProviders } from '@/hooks/useProviders'

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
  
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  
  const { register, handleSubmit, formState: { errors }, watch, setValue, getValues } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      isDefault: false,
      wrapperEnabled: true,
    },
  })
  
  const name = watch('name')
  const providerId = watch('providerId')
  
  // Auto-generate route and command when name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValue('name', value)
    if (value) {
      setValue('routePath', generateRoutePath(value))
      setValue('commandName', generateCommandName(value))
    }
  }
  
  const selectedProvider = providers.find(p => p.id === providerId)
  
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Create Profile</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4">
            <div>
              <label className="label">Profile Name</label>
              <input 
                {...register('name')} 
                onChange={handleNameChange}
                className="input" 
                placeholder="Claude MiniMax" 
              />
              {errors.name && <p className="text-sm text-[var(--error)] mt-1">{errors.name.message}</p>}
            </div>
            
            <div>
              <label className="label">Provider</label>
              <select {...register('providerId')} className="input">
                <option value="">Select a provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.defaultModel})
                  </option>
                ))}
              </select>
              {errors.providerId && <p className="text-sm text-[var(--error)] mt-1">{errors.providerId.message}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Route Path</label>
                <input {...register('routePath')} className="input" placeholder="/minimax" />
                {errors.routePath && <p className="text-sm text-[var(--error)] mt-1">{errors.routePath.message}</p>}
              </div>
              
              <div>
                <label className="label">Command Name</label>
                <input {...register('commandName')} className="input" placeholder="claude-minimax" />
                {errors.commandName && <p className="text-sm text-[var(--error)] mt-1">{errors.commandName.message}</p>}
              </div>
            </div>
            
            <div>
              <label className="label">Model</label>
              <input 
                {...register('model')} 
                className="input" 
                placeholder={selectedProvider?.defaultModel ?? 'glm-4'}
                defaultValue={selectedProvider?.defaultModel}
              />
              {errors.model && <p className="text-sm text-[var(--error)] mt-1">{errors.model.message}</p>}
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('isDefault')} className="w-4 h-4" />
                <span className="text-sm">Set as default profile</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('wrapperEnabled')} defaultChecked className="w-4 h-4" />
                <span className="text-sm">Generate wrapper</span>
              </label>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Profile
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
```

### 6.10 SettingsModal 组件

```tsx
// src/components/settings/SettingsModal.tsx

import { motion } from 'framer-motion'
import { X, FolderOpen, Download, Upload, RotateCcw } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { data: settings } = useSettings()
  
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
        exit={{ scale: 0.95, opacity: 1 }}
        className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-xl mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)]">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* General */}
          <section>
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
              General
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-[var(--text-muted)]">Choose your preferred theme</p>
                </div>
                <select className="input w-32" defaultValue={settings?.theme}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Start on login</p>
                  <p className="text-sm text-[var(--text-muted)]">Launch Clair when you log in</p>
                </div>
                <input type="checkbox" className="w-5 h-5" />
              </div>
            </div>
          </section>
          
          {/* Proxy */}
          <section>
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
              Proxy
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Host</label>
                  <input 
                    className="input" 
                    defaultValue={settings?.proxyHost ?? '127.0.0.1'}
                    readOnly 
                  />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input 
                    className="input" 
                    defaultValue={settings?.proxyPort ?? 18789}
                    readOnly 
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Start proxy on launch</p>
                </div>
                <input type="checkbox" className="w-5 h-5" defaultChecked />
              </div>
            </div>
          </section>
          
          {/* Claude Code */}
          <section>
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
              Claude Code
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Claude Binary Path</label>
                <div className="flex gap-2">
                  <input 
                    className="input flex-1" 
                    defaultValue={settings?.claudeBinaryPath}
                    placeholder="Auto-detected"
                  />
                  <button className="btn-secondary flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </button>
                </div>
              </div>
              
              <div>
                <label className="label">Wrapper Directory</label>
                <input 
                  className="input" 
                  defaultValue={settings?.wrapperDir ?? '~/.local/bin'}
                  readOnly 
                />
              </div>
            </div>
          </section>
          
          {/* Data */}
          <section>
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
              Data
            </h3>
            <div className="flex gap-2">
              <button className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="btn-secondary flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button className="btn-secondary flex items-center gap-2 text-[var(--error)]">
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  )
}
```

### 6.11 Toast 组件

```tsx
// src/components/common/Toast.tsx

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: AlertCircle,
}

const colors: Record<ToastType, string> = {
  success: 'bg-[var(--success)]',
  error: 'bg-[var(--error)]',
  warning: 'bg-[var(--warning)]',
  info: 'bg-[var(--primary)]',
}

export function Toast() {
  const { toasts, removeToast } = useToast()
  
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type]
          
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)]"
            >
              <div className={`w-8 h-8 rounded-full ${colors[toast.type]}/10 
                            flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${colors[toast.type]}`} />
              </div>
              <p className="flex-1 text-sm">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
```

---

## 7. App 入口

```tsx
// src/app/App.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/MainLayout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout />
    </QueryClientProvider>
  )
}
```

```tsx
// src/main.tsx

import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

## 8. 开发注意事项

### 8.1 动画原则

使用 Framer Motion 时遵循：
- 快速：150ms ~ 220ms
- 柔和 ease-out
- 不弹跳
- 不花哨

### 8.2 状态刷新策略

| 数据 | 刷新策略 |
|------|---------|
| Proxy Status | 每 5 秒轮询 |
| Providers | 手动 invalidate |
| Profiles | 手动 invalidate |
| Settings | 手动 invalidate |

### 8.3 错误处理

所有 mutation 使用 `onError` 显示 toast 错误提示。

### 8.4 空状态设计

无 Provider 时：
```tsx
<div className="text-center py-12 text-[var(--text-muted)]">
  <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
  <p className="font-medium">No providers yet</p>
  <p className="text-sm mt-1">Add your first provider to start routing Claude Code locally.</p>
  <button className="btn-primary mt-4">Add Provider</button>
</div>
```