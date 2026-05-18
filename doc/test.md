# Clair 测试文档

> 本文档定义 Clair 产品的功能测试、安全测试和技术验收标准。

---

## 1. 测试概述

### 1.1 测试目标

验证 Clair 产品满足 PRD 中定义的所有功能需求和非目标边界，确保：
- 核心功能稳定可用
- UI 交互符合设计规范
- 数据安全符合要求
- 用户验收标准达成

### 1.2 测试范围

| 模块 | 测试内容 |
|------|---------|
| Provider 管理 | CRUD、连接测试 |
| Profile 管理 | CRUD、路由校验、Command 校验 |
| 本地代理 | 路由转发、Model Override、Streaming |
| Wrapper | 生成、检查、权限 |
| UI | 布局、交互、动效、空状态 |
| 安全 | 监听地址、Token 验证、日志脱敏 |

### 1.3 测试环境

```
测试环境：
- OS: Ubuntu 22.04 LTS
- Claude Code: 已安装
- Node.js: 18+
- Rust: 1.75+
- 测试 Provider: Zhipu GLM (真实)、MiniMax (模拟)
```

---

## 2. 功能验收测试

### 2.1 Provider 管理

#### TC-PM-001: 新增 Provider

**前置条件**：Clair 已启动，数据库为空

**操作步骤**：
1. 点击 "Add Provider"
2. 选择类型 "Anthropic-compatible"
3. 填写表单：
   - Name: `Test GLM`
   - Base URL: `https://open.bigmodel.cn/api/anthropic`
   - API Key: `测试用 API Key`
   - Auth Scheme: `x-api-key`
   - Default Model: `glm-4`
4. 点击 "Test"
5. 点击 "Save Provider"

**预期结果**：
- [x] Test 连接成功，显示 latency
- [x] Provider 出现在列表中
- [x] Provider 状态为 "Ready"
- [x] 关闭重开后 Provider 仍存在

**测试代码**：
```typescript
// test/provider.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MainLayout } from '@/components/layout/MainLayout'
import { useProviders, useCreateProvider } from '@/hooks/useProviders'

describe('Provider Management', () => {
  it('TC-PM-001: should create a new provider', async () => {
    // Mock the API
    vi.mock('@/lib/api', () => ({
      listProviders: vi.fn().mockResolvedValue([]),
      createProvider: vi.fn().mockResolvedValue({
        id: 'test-id',
        name: 'Test GLM',
        type: 'anthropic_compatible',
        baseUrl: 'https://open.bigmodel.cn/api/anthropic',
        apiKey: 'test-key',
        authScheme: 'x_api_key',
        defaultModel: 'glm-4',
        enableStreaming: true,
        status: 'ready',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    }))

    render(<MainLayout />)

    // Open add provider modal
    const addButton = screen.getByText('Add Provider')
    fireEvent.click(addButton)

    // Fill form
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test GLM' } })
    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'https://open.bigmodel.cn/api/anthropic' } })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'test-key' } })
    fireEvent.change(screen.getByLabelText('Default Model'), { target: { value: 'glm-4' } })

    // Save
    fireEvent.click(screen.getByText('Save Provider'))

    await waitFor(() => {
      expect(screen.getByText('Test GLM')).toBeInTheDocument()
    })
  })
})
```

#### TC-PM-002: 编辑 Provider

**前置条件**：存在至少一个 Provider

**操作步骤**：
1. 点击 Provider 卡片
2. 点击 "Edit" 按钮
3. 修改 Name 为 `Updated GLM`
4. 点击 "Save"

**预期结果**：
- [x] Provider 名称更新为 "Updated GLM"
- [x] 其他字段保持不变

#### TC-PM-003: 删除 Provider（无引用）

**前置条件**：存在未被任何 Profile 引用的 Provider

**操作步骤**：
1. 选中目标 Provider
2. 点击 "Delete" 按钮
3. 确认删除

**预期结果**：
- [x] Provider 从列表移除
- [x] 数据库中记录已删除

#### TC-PM-004: 删除 Provider（有引用）

**前置条件**：存在被 Profile 引用的 Provider

**操作步骤**：
1. 尝试删除被引用的 Provider

**预期结果**：
- [x] 显示错误提示："This provider is used by N profiles: ..."
- [x] Provider 不被删除

#### TC-PM-005: 测试 Provider 连接

**前置条件**：已配置真实 Provider

**操作步骤**：
1. 选中 Provider
2. 点击 "Test" 按钮
3. 等待测试结果

**预期结果**：
- [x] 连接成功时显示：`Connected, Latency: XXXms, Model: glm-4`
- [x] 连接失败时显示对应错误信息（401/404/Timeout）

---

### 2.2 Profile 管理

#### TC-PM-201: 创建 Profile

**前置条件**：存在至少一个 Provider

**操作步骤**：
1. 点击 "New Profile"
2. 填写 Profile 名称 `Claude MiniMax`
3. 自动生成 route `/claude-minimax` 和 command `claude-minimax`
4. 选择 Provider
5. 选择/填写 Model
6. 点击 "Create Profile"

**预期结果**：
- [x] Profile 出现在左侧列表
- [x] 右侧详情面板显示 Profile 信息
- [x] Wrapper 已生成（如开启）

#### TC-PM-202: Route 重复校验

**前置条件**：已存在 `/glm` 路由

**操作步骤**：
1. 创建新 Profile
2. 手动填写 Route Path 为 `/glm`

**预期结果**：
- [x] 显示错误："Route path already exists"
- [x] 无法创建

#### TC-PM-203: 保留路由校验

**前置条件**：无

**操作步骤**：
1. 创建新 Profile
2. 填写 Route Path 为 `/health`

**预期结果**：
- [x] 显示错误："This route path is reserved"
- [x] 无法创建

#### TC-PM-204: Command 危险命令校验

**前置条件**：无

**操作步骤**：
1. 创建新 Profile
2. 填写 Command Name 为 `rm`

**预期结果**：
- [x] 显示错误："This command name is not allowed"
- [x] 无法创建

#### TC-PM-205: 设置默认 Profile

**前置条件**：存在多个 Profile

**操作步骤**：
1. 选择非默认 Profile
2. 设置为默认

**预期结果**：
- [x] 原默认 Profile 取消默认状态
- [x] 新 Profile 显示为默认
- [x] 默认只有一个

#### TC-PM-206: 删除 Profile

**前置条件**：存在至少一个 Profile

**操作步骤**：
1. 选中目标 Profile
2. 删除 Profile

**预期结果**：
- [x] Profile 从列表移除
- [x] Wrapper 文件被删除（如存在）

---

### 2.3 本地代理服务

#### TC-PR-001: 启动代理

**前置条件**：Clair 已启动

**操作步骤**：
1. 点击 "Start Proxy" 按钮

**预期结果**：
- [x] 按钮变为 "Stop Proxy"
- [x] Status 显示 "Running"
- [x] 绿灯亮起

#### TC-PR-002: 健康检查

**前置条件**：代理已启动

**操作步骤**：
1. 执行 `curl http://127.0.0.1:18789/health`

**预期结果**：
- [x] 返回 `ok`

#### TC-PR-003: 请求路由

**前置条件**：代理已启动，存在 `/glm` Profile

**操作步骤**：
1. 执行测试请求到 `http://127.0.0.1:18789/glm/v1/messages`
2. 设置正确的 Authorization header

**预期结果**：
- [x] 请求被路由到对应 Provider
- [x] Model 被正确覆盖

#### TC-PR-004: Model Override

**前置条件**：代理已启动，存在 Profile 配置 model 为 `glm-4`

**操作步骤**：
1. 发送请求 body 中 model 设置为 `claude-sonnet-4-5`
2. 通过代理转发

**预期结果**：
- [x] 上游 Provider 收到的请求中 model 为 `glm-4`

#### TC-PR-005: Streaming 响应

**前置条件**：代理已启动，Provider 支持 streaming

**操作步骤**：
1. 发送流式请求到代理

**预期结果**：
- [x] SSE 流被正确透传
- [x] `Content-Type: text/event-stream` 保持正确

#### TC-PR-006: 错误处理

**前置条件**：代理已启动

**操作步骤**：
1. 请求不存在的 route `/nonexistent`
2. 请求 Provider 连接失败的情况

**预期结果**：
- [x] 返回 404 状态
- [x] 错误 body 符合 Anthropic 格式

---

### 2.4 Wrapper 生成

#### TC-WR-001: 生成 Wrapper

**前置条件**：Profile 已创建

**操作步骤**：
1. 选中 Profile
2. 点击 "Regenerate Wrapper"

**预期结果**：
- [x] Wrapper 文件生成在 `~/.local/bin/claude-xxx`
- [x] 文件权限为 755

#### TC-WR-002: Wrapper 功能验证

**前置条件**：Wrapper 已生成，代理已启动

**操作步骤**：
1. 终端执行 `claude-minimax --version`
2. 或设置环境变量后执行 `echo $ANTHROPIC_BASE_URL`

**预期结果**：
- [x] `ANTHROPIC_BASE_URL` 设置为 `http://127.0.0.1:18789/minimax`
- [x] `ANTHROPIC_AUTH_TOKEN` 设置为 Clair local token

#### TC-WR-003: 检测 Claude Binary

**前置条件**：Claude Code 已安装

**操作步骤**：
1. 调用 `detect_claude_binary` 命令

**预期结果**：
- [x] 返回 `found: true`
- [x] `path` 指向正确路径
- [x] `candidates` 列出所有可能的路径

---

## 3. UI 验收测试

### 3.1 布局测试

#### TC-UI-001: 三栏布局

**检查点**：
- [x] 左侧 Profiles 栏（固定宽度 256px）
- [x] 中间 Provider 列表（flex-1）
- [x] 右侧详情面板（固定宽度 320px）
- [x] 顶部状态栏（高度 56px）

#### TC-UI-002: 视觉风格

**检查点**：
- [x] 背景色为暖白 `#F7F4EF`
- [x] 主色调为陶土橙 `#C96F3A`
- [x] 卡片圆角为 16px
- [x] 按钮圆角为 12px
- [x] 边框色为 `#E7E0D6`
- [x] 无粗糙阴影，使用柔和阴影

#### TC-UI-003: 动效

**检查点**：
- [x] Modal 打开/关闭有缩放动画（0.95 → 1）
- [x] 动效时长 150-220ms
- [x] 卡片 hover 有微上浮效果
- [x] 无弹跳效果

---

### 3.2 交互测试

#### TC-UI-101: Provider 选中

**操作**：点击 Provider 卡片

**预期**：
- [x] 卡片边框变为橙色
- [x] 右侧显示 Provider 详情
- [x] 左侧 Profile 选中状态取消

#### TC-UI-102: Profile 选中

**操作**：点击 Profile 项目

**预期**：
- [x] 背景变为浅橙色
- [x] 右侧显示 Profile 详情
- [x] Provider 选中状态取消

#### TC-UI-103: 空状态 - 无 Provider

**前置条件**：Provider 列表为空

**预期**：
- [x] 显示空状态提示文案
- [x] 显示 "Add Provider" 按钮

#### TC-UI-104: 空状态 - 无 Profile

**前置条件**：Profile 列表为空

**预期**：
- [x] 显示空状态提示文案
- [x] "No profiles yet. Profiles create commands like claude-glm or claude-minimax."

#### TC-UI-105: Toast 提示

**操作**：执行添加 Provider 操作

**预期**：
- [x] 成功时显示绿色 toast："Provider saved."
- [x] 失败时显示红色 toast："Could not connect to provider."

---

## 4. 安全验收测试

### 4.1 网络安全

#### TC-SC-001: 默认监听地址

**验证**：检查代理配置

**预期**：
- [x] 默认监听 `127.0.0.1`
- [x] 不监听 `0.0.0.0` 或公网地址

#### TC-SC-002: Token 验证

**前置条件**：代理已启动

**操作**：
1. 不带 Authorization header 请求代理
2. 带错误 token 请求代理

**预期**：
- [x] 请求被拒绝
- [x] 返回 401 或类似错误

---

### 4.2 数据安全

#### TC-SC-101: API Key 脱敏

**验证**：检查日志输出

**预期**：
- [x] 日志中 API Key 显示为 `sk-****abcd` 格式
- [x] 不显示完整 API Key

#### TC-SC-102: 导出配置

**操作**：导出配置

**预期**：
- [x] 默认导出不包含 API Key
- [x] 提供 "Export with secrets" 选项（需二次确认）

#### TC-SC-103: 删除引用检查

**验证**：Provider 删除流程

**预期**：
- [x] 删除被引用的 Provider 时有错误提示
- [x] 需要先删除或转移 Profile

---

## 5. 技术验收测试

### 5.1 数据持久化

#### TC-TECH-001: SQLite 存储

**验证**：重启应用后数据存在

**操作**：
1. 添加 Provider A
2. 创建 Profile B
3. 关闭应用
4. 重新启动应用

**预期**：
- [x] Provider A 仍存在
- [x] Profile B 仍存在

#### TC-TECH-002: 设置持久化

**操作**：
1. 修改代理端口（假设支持）
2. 重启应用

**预期**：
- [x] 设置保持

---

### 5.2 并行运行

#### TC-TECH-101: 双实例并行

**前置条件**：生成了 `claude-glm` 和 `claude-minimax` 两个命令

**操作**：
1. 终端 A 执行 `claude-glm`
2. 终端 B 执行 `claude-minimax`

**预期**：
- [x] 两个 Claude Code 实例同时运行
- [x] 各自使用不同 Provider
- [x] 配置互不干扰

---

## 6. 端到端测试

### E2E-001: 完整用户流程

**目标**：验证产品核心价值链

**前置条件**：全新安装，无数据

**操作步骤**：
1. 启动 Clair
2. 添加 Provider: Zhipu GLM
3. 添加 Provider: MiniMax
4. 创建 Profile: `claude-glm` → GLM
5. 创建 Profile: `claude-minimax` → MiniMax
6. 启动代理
7. 终端 A: `claude-glm`
8. 终端 B: `claude-minimax`
9. 两个 Claude Code 实例分别请求

**验收标准**：
- [x] 核心链路打通
- [x] 两个 Claude Code 并行运行
- [x] 路由正确分流

---

## 7. 测试报告模板

### 7.1 测试结果汇总

| 模块 | 用例数 | 通过 | 失败 | 通过率 |
|------|--------|------|------|--------|
| Provider 管理 | 5 | X | X | XX% |
| Profile 管理 | 6 | X | X | XX% |
| 本地代理 | 6 | X | X | XX% |
| Wrapper | 3 | X | X | XX% |
| UI | 5 | X | X | XX% |
| 安全 | 3 | X | X | XX% |
| 技术 | 3 | X | X | XX% |
| **总计** | **31** | **X** | **X** | **XX%** |

### 7.2 遗留问题记录

| ID | 模块 | 描述 | 严重度 | 状态 |
|----|------|------|--------|------|
| BUG-001 | - | - | - | - |

---

## 8. 验收通过标准

### 8.1 功能验收清单（来自 PRD 19.1）

- [ ] 可以新增 Provider
- [ ] 可以编辑 Provider
- [ ] 可以删除未被引用的 Provider
- [ ] 可以测试 Provider
- [ ] 可以新增 Profile
- [ ] 可以设置默认 Profile
- [ ] 可以启动本地代理
- [ ] 可以停止本地代理
- [ ] 可以查看代理状态
- [ ] 可以生成 wrapper
- [ ] 可以检测 Claude Code 路径
- [ ] 可以复制启动命令
- [ ] 可以并行运行两个不同 Profile

### 8.2 UI 验收清单（来自 PRD 19.2）

- [ ] 主界面三栏布局清晰
- [ ] 暖白 + 陶土橙视觉风格
- [ ] 卡片有精致边框和留白
- [ ] 表单不拥挤
- [ ] 空状态友好
- [ ] 错误提示明确
- [ ] 按钮层级清晰
- [ ] 不像粗糙后台管理系统

### 8.3 安全验收清单（来自 PRD 19.3）

- [ ] 默认监听 127.0.0.1
- [ ] 本地代理需要 token
- [ ] 日志不显示完整 API key
- [ ] 导出配置默认不含 secret
- [ ] 删除 Provider 有引用检查

### 8.4 技术验收清单（来自 PRD 19.4）

- [ ] SQLite 数据持久化正常
- [ ] 代理支持 streaming
- [ ] model override 正常
- [ ] wrapper chmod +x 正常
- [ ] PATH 检测正常
- [ ] Linux 打包可安装

---

## 9. 最终评估

### 9.1 是否通过 MVP 验收

基于上述测试结果，评估：

**通过标准**：
- [ ] 功能验收清单 ≥ 12/13 通过
- [ ] UI 验收清单 ≥ 7/8 通过
- [ ] 安全验收清单 = 5/5 通过
- [ ] 技术验收清单 ≥ 5/6 通过

**最终结论**：

```
产品名称: Clair
版本: v1.0 MVP
验收结论: [ ] 通过  [ ] 未通过
缺陷数: X 个（严重 X 个，主要 X 个，次要 X 个）
建议: ...
```

### 9.2 风险提示

| 风险 | 描述 | 缓解措施 |
|------|------|----------|
| R-001 | Provider 连接不稳定 | 做好超时和重试机制 |
| R-002 | Streaming 处理问题 | 充分测试流式响应场景 |
| R-003 | Wrapper 路径冲突 | 做好检测和提示 |

---

*本文档基于 `doc/prd.md` 生成，测试用例与 PRD 验收清单保持一致。*