# Clair linux-dev 分支重构方案

## 1. 背景与问题

### 1.1 两个分支的实现差异

main 分支（Windows）通过 `claude --settings <profile.settings.json>` 方式注入环境变量。settings 文件中的 `env` 字段可被 Claude Code 正确读取。

### 1.2 linux-dev 的核心问题

1. **过度删减**：适配 Linux 时删除了大量跨平台功能（验证、诊断、stale 检测等）
2. **环境变量方案不可靠**：原始 Linux wrapper 使用 `export` 环境变量 + `exec claude`，但 Claude Code 不尊重 `ANTHROPIC_MODEL` 等环境变量来选择模型

## 2. 重构方案（已执行）

### Phase 1: 恢复跨平台功能

从 main 分支恢复了所有被过度删减的跨平台功能：

- `ClaudeBinaryVerification`（Claude 探测 + 验证）
- `WrapperPathDiagnostics`（PATH 诊断）
- `WrapperArtifacts` + stale 检测
- `SettingsService::persist_missing_defaults`
- `delete_setting` DB 方法
- 前端探测/验证/PATH 诊断/wrapper 状态 UI
- 单元测试

### Phase 2: Linux wrapper 改用 `--settings` 方案

将 Linux wrapper 从环境变量方案改为与 Windows 一致的 `--settings` 方案：

**之前（不可靠）：**
```bash
#!/usr/bin/env bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:28789/glm"
export ANTHROPIC_MODEL="glm-4.7"
exec claude "$@"
```

**之后（已验证通过）：**
```bash
#!/usr/bin/env bash
CLAUDE_BIN="/home/user/.local/bin/claude"
CLAIR_SETTINGS="/home/user/.local/bin/profiles/claude-glm.settings.json"
exec "$CLAUDE_BIN" --settings "$CLAIR_SETTINGS" "$@"
```

`profiles/claude-glm.settings.json` 内容：
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:28789/glm",
    "ANTHROPIC_AUTH_TOKEN": "clair-xxx",
    "ANTHROPIC_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.7"
  }
}
```

## 3. 修改的文件

### Phase 1 (17 个文件从 main 恢复 + 手动修改)

- 从 main 分支 checkout 13 个 Rust 后端文件
- 从 main 分支 checkout 7 个前端文件
- 手动修改 `db/mod.rs`（恢复 `delete_setting`）、`lib.rs`（注册命令）、`Cargo.toml`（恢复 tempfile）
- 修正 wrapper_service.rs 测试为 Unix 测试
- 修正 SettingsModal.tsx wrapperDir placeholder

### Phase 2 (3 个文件)

- `src-tauri/src/services/wrapper_service.rs` — Linux wrapper 改为 `--settings` 调用，settings JSON 生成跨平台通用
- `src/lib/i18n.tsx` — 更新 runtimeModelHint 中英文提示
- `README.md` — 记录重构计划

## 4. 与 main 分支的差异

仅以下差异：

| 文件 | 差异 |
|------|------|
| `tauri.conf.json` | `bundle.targets`: `["deb", "appimage"]`（vs main 的 `["nsis"]`） |
| `wrapper_service.rs` | 测试用例使用 Unix 路径和函数 |
| `SettingsModal.tsx` | wrapperDir placeholder: `~/.local/bin`（vs main 的 `%LOCALAPPDATA%\\Clair\\bin`） |
| `i18n.tsx` | runtimeModelHint 去掉了 "Windows" 字样 |
| `README.md` | 新增 Linux 重构计划章节 |
| `doc/` | main 有 Windows 相关文档，linux-dev 有 Linux 重构文档 |

## 5. 验收结果

- `cargo check` ✅
- `cargo test` (23 个) ✅
- `npm run build` ✅
- 实际测试：`claude-glm2` 启动后 Claude Code 正确显示 glm-4.7 模型 ✅
