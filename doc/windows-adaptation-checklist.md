# Clair Windows 化改造清单

## 目标

- 保持现有产品功能不变
- 保持现有前端 UI 和视觉风格不变
- 将 `main` 改造成 Windows 主线
- `linux-dev` 保留当前 Linux 运行模型

## 当前结论

当前仓库已经可以在这台 Windows 开发机上完成：

- 前端构建
- Rust 编译
- Tauri debug 构建
- Rust 单元测试

但这不等于项目已经完成 Windows 化。现阶段真正的问题不是开发环境，而是运行模型仍明显偏 Linux。

## 当前 Windows 开发环境状态

已验证通过：

- Node.js / npm
- Rust / cargo / rustup
- Tauri CLI
- WebView2 Runtime
- MSVC toolchain

已验证命令：

- `npm run build`
- `cargo build --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npx tauri build --debug`

说明：

- 当前机器具备后续 Windows 化开发条件
- 后续工作重点应放在项目代码和运行机制改造，而不是环境补齐

## 现有架构中与 Linux 绑定的部分

### 1. Wrapper 生成机制强绑定 bash

证据：

- `src-tauri/src/services/wrapper_service.rs`
- 当前 wrapper 内容是 `#!/usr/bin/env bash`
- 使用 `command -v`
- 依赖 Unix 可执行权限 `0o755`

影响：

- 现有 `claude-xxx` 生成物在 Linux/macOS 可直接作为 shell 命令使用
- Windows 下不能继续沿用同一套 wrapper 形态

必须改造项：

- 为 Windows 单独生成 `.cmd` 或 `.bat` 启动器
- 或者改为生成 PowerShell 启动器
- 启动器仍需保持“按 profile 启动不同 provider”的产品能力

建议方向：

- 主方案：生成 `.cmd`
- 可选方案：同时提供 `.ps1`

### 2. 默认路径仍是 Linux 目录语义

证据：

- `src-tauri/src/domain/settings.rs`
- `src/components/settings/SettingsModal.tsx`
- `README.md`

当前默认值：

- wrapper 目录：`~/.local/bin`
- 数据目录文档：`~/.config/clair/`

影响：

- Windows 用户看到的默认配置不符合平台习惯
- PATH 集成逻辑也不匹配 Windows

必须改造项：

- 为 Windows 设置单独默认 wrapper 目录
- 建议使用用户目录下的应用专属 bin 目录

建议候选：

- `%USERPROFILE%\\AppData\\Local\\Clair\\bin`
- `%USERPROFILE%\\.clair\\bin`

说明：

- 数据库存储本身已经通过 `dirs::config_dir()` 走平台目录，核心代码不是阻塞
- 但 README、默认展示值、wrapper 路径心智都需要一起改

### 3. Claude 二进制探测逻辑仍以 Linux 为主

证据：

- `src-tauri/src/services/claude_detect_service.rs`

当前探测方式：

- `/usr/local/bin/claude`
- `/usr/bin/claude`
- `~/.local/bin/claude`
- `which claude`

影响：

- Windows 下自动探测结果不可靠
- 需要手动配置 `claude_binary_path` 的概率很高

必须改造项：

- Windows 分支中改用 `where claude`
- 增加常见 Windows 安装路径候选
- 明确支持 `.cmd` / `.exe` / shim 脚本探测

建议候选路径：

- `%APPDATA%\\npm\\claude.cmd`
- `%LOCALAPPDATA%\\Programs\\Claude\\...`
- 用户自定义 Node/npm 全局 bin 目录

### 4. 打包目标仍是 Linux

证据：

- `src-tauri/tauri.conf.json`

当前配置：

- `bundle.targets = ["deb", "appimage"]`

影响：

- 这套配置不适合作为 Windows 主线发布配置

必须改造项：

- 为 Windows 主线切换 bundle target
- 明确是否输出：
  - `nsis`
  - `msi`

建议：

- 首选 `nsis`
- 后续如有企业分发需求再补 `msi`

### 5. 文档和操作说明全部偏 Linux

证据：

- `README.md`

当前文档内容包括：

- `~/.local/bin/claude-glm`
- `src-tauri/target/release/clair`
- Linux 风格使用路径和启动方式

影响：

- 用户按文档操作会直接踩平台差异
- 后续 Windows 版本发布时会形成错误预期

必须改造项：

- 重写 README 的运行说明
- 区分 Linux 分支与 Windows 主线
- 补充 Windows 安装、PATH、wrapper 位置、产物位置

## Windows 主线真正需要改造的模块

### P0：运行链路改造

这是最优先的部分，不改这里，Windows 版只是“能编译”，不是“能用”。

#### P0-1. 重新定义 Windows wrapper 形态

需要决定：

- 生成 `.cmd` 启动器
- 还是生成 `.ps1`
- 是否两者都提供

建议：

- 默认生成 `.cmd`
- `.cmd` 内部负责：
  - 设置 `ANTHROPIC_BASE_URL`
  - 设置 `ANTHROPIC_AUTH_TOKEN`
  - 设置 `ANTHROPIC_MODEL` 和默认模型映射
  - 调用真实 `claude`

#### P0-2. 明确 Windows 下“命令可用”的交付方式

Linux 下的用户心智是：

- 生成到 `~/.local/bin`
- PATH 中可直接执行 `claude-glm`

Windows 下必须明确：

- 生成目录是否自动加入 PATH
- 若不自动加，UI 如何提示用户
- 是否提供“一键打开 wrapper 目录”

建议：

- 不在第一阶段自动改系统 PATH
- 先保证启动器可生成、可点击、可复制完整路径执行
- 第二阶段再考虑 PATH 自动注入

#### P0-3. Claude 运行时探测与调用

需要补齐：

- `where claude`
- `.cmd` / `.exe` / npm shim 的兼容
- `claude_binary_path` 的实际可用性验证

建议：

- 增加“探测结果 + 可执行验证”
- 不只是找到路径，还要验证能否启动

### P1：设置和交互适配

#### P1-1. Settings 默认值平台化

需要改：

- `wrapperDir` 默认值
- 设置页 placeholder / 展示值
- 相关文案

#### P1-2. Wrapper 状态检查平台化

当前：

- `check_command_in_path` 已经有 Windows 分支

仍需补：

- `.cmd` 存在性检查
- 实际执行性验证
- stale 判定

说明：

- 当前 `stale` 仍是固定 `false`
- 后续 Windows 版更需要补齐，因为用户更依赖生成器状态反馈

#### P1-3. 增加 Windows 友好的操作入口

建议增加但不改变 UI 风格：

- 打开 wrapper 目录
- 复制完整启动命令
- 显示真实生成文件名，例如 `claude-glm.cmd`

### P1.5：配置策略决策

这里需要先做一个产品决策。

#### 方案 A：继续坚持“wrapper + 环境变量 + 本地 proxy”

优点：

- 与当前 Linux 架构一致
- 不需要直接改 `~/.claude/settings.json`
- 多 profile 并行隔离更好

缺点：

- Windows 命令分发和 PATH 体验要自己补
- 对用户来说不如“改一下全局配置”直观

#### 方案 B：改为直接管理 Claude 的 `settings.json`

优点：

- 更接近用户现在手工配置 MiniMax 的方式
- 对单一当前 provider 切换很直接

缺点：

- 会污染用户全局 Claude 配置
- 需要严格做备份、回滚、增量写入、恢复
- 不利于并行多 profile

建议：

- `main` 第一阶段仍坚持方案 A
- 不要在 Windows 化第一步就改成 `settings.json` 写入模式

理由：

- 这样能保持产品功能和架构意图基本一致
- 变更更可控
- 风险更低

### P2：打包与分发

#### P2-1. Tauri bundle target

需要改：

- 从 `deb/appimage` 切到 Windows target

#### P2-2. 图标、安装器、产物命名

需要补：

- Windows 安装包产物路径说明
- `exe` / 安装器命名规范

#### P2-3. 自动启动与托盘行为验证

当前字段已经存在：

- `start_app_on_login`
- `minimize_to_tray`

需要确认：

- Windows 上这些能力是否真正实现
- 若未实现，是否先降级为 UI 占位，还是同步补齐

## 不需要大改的部分

这些可以基本保持不变：

- Provider / Profile / Proxy 的核心领域模型
- 前端整体布局
- 当前配色、视觉风格、组件结构
- Proxy 转发和 model rewrite 的核心思路
- Provider 测试、Profile E2E、Runtime Evidence 这套调试能力

## 推荐实施顺序

### 第一阶段：让 Windows 版本真正可用

1. Windows wrapper 生成方案定稿
2. Claude 二进制探测改造
3. Windows 默认 wrapper 目录
4. Settings 页面和文案改造
5. wrapper 状态检查、stale 判定
6. README 改写为 Windows 主线说明

验收标准：

- 用户在 Windows 上能创建 provider/profile
- 能生成可执行的 Windows 启动器
- 能通过启动器打开 Claude
- 能通过 runtime evidence 看到真实 route/provider/model rewrite

### 第二阶段：Windows 分发成型

1. 调整 Tauri bundle target
2. 生成 Windows 安装包
3. 校验 PATH 体验和启动体验
4. 校验托盘、开机启动、设置持久化

### 第三阶段：提升易用性

1. 是否自动加入 PATH
2. 是否支持一键恢复/重建 launcher
3. 是否支持多种 launcher 形式
4. 是否增加“打开目录/复制绝对命令”等辅助入口

## 当前最重要的判断

如果后续 `main` 要改造成 Windows 版本，同时保持现有功能、UI、风格不变，那么：

- 前端不是主要成本
- 数据库不是主要成本
- Proxy 不是主要成本
- 最大成本在：
  - wrapper 机制 Windows 化
  - Claude 探测与启动 Windows 化
  - 打包与交付 Windows 化

## 建议的下一步

直接进入实现时，建议先做第一批最小改造：

1. 设计 Windows launcher 方案（`.cmd` 为主）
2. 改造 `WrapperService`
3. 改造 `ClaudeDetectService`
4. 改造默认 `wrapper_dir`
5. 改造设置页文案和展示
6. 重写 README 的 Windows 使用说明

完成这 6 项后，`main` 才算真正开始进入 Windows 主线。
