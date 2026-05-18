# Clair Linux Platform Code Review Report

## Scope

- Review target: Linux-platform runtime behavior, code bugs, edge cases, and engineering risks.
- Out of scope for this report: Windows migration and platform-porting fixes.
- Current turn does not apply code fixes; this is a review-only report.

## Verification Notes

- Frontend dependency install completed successfully with `npm install`.
- Frontend production build passed with `npm run build`.
- Rust side was reviewed statically in this turn. A live `cargo check` was not completed from the current Windows host because Tauri build setup blocks before normal Rust checking. That limitation does not change the code-level findings below.

## Findings

### 1. Critical: proxy config reload does not update the live router

- Files:
  - `src-tauri/src/commands/proxy.rs:82-99`
  - `src-tauri/src/commands/proxy.rs:126-143`
  - `src-tauri/src/commands/proxy.rs:168-185`
  - `src-tauri/src/proxy/server.rs:72-81`
- Problem:
  - `start_proxy` builds the Axum router once from `server_clone.read().await.build_router()`.
  - `build_router()` then snapshots `self.clone()` into a new `Arc<ProxyServer>`.
  - Later `reload_proxy_config()` only mutates the `RwLock<ProxyServer>` held by `ProxyState`; the router is still serving requests from the old snapshot.
- Impact:
  - Editing providers/profiles while the proxy is running appears to succeed in UI, but live traffic can continue using stale route/provider config.
  - This can cause "why is the old route still active" or "why is the old key still being used" style bugs.
- Recommendation:
  - The request handler state must reference shared mutable config instead of a cloned snapshot, or reload must rebuild and replace the whole server/router.

### 2. Critical: proxy accepts requests with no auth header at all

- Files:
  - `src-tauri/src/proxy/server.rs:104-120`
- Problem:
  - The code validates `authorization` if present, otherwise validates `x-api-key` if present.
  - If neither header exists, the request falls through as authorized.
- Impact:
  - Any local process on the same machine can call the proxy without the configured local token.
  - This defeats the intended local-token protection described by the product docs.
- Recommendation:
  - Treat "no token provided" as unauthorized, not as success.

### 3. High: backend profile validation is too weak and can lead to invalid routes and unsafe wrapper paths

- Files:
  - `src-tauri/src/commands/profile.rs:44-55`
  - `src-tauri/src/commands/profile.rs:171-185`
  - `src-tauri/src/security/validation.rs:1-23`
  - `src-tauri/src/services/wrapper_service.rs:35-36`
  - `src-tauri/src/services/wrapper_service.rs:79`
- Problem:
  - Backend only checks that `route_path` starts with `/` and is not reserved.
  - Backend only checks whether `command_name` is in a tiny exact-match denylist.
  - It does not enforce the frontend regex constraints.
  - A crafted `command_name` like `../../somefile` or names containing separators/spaces can reach `wrapper_dir.join(&profile.command_name)` and then `fs::write`.
- Impact:
  - Direct Tauri command invocation can bypass the frontend validator.
  - Invalid routes can be saved even though the proxy parser only understands the first path segment.
  - Unsafe command names can become arbitrary file-write or path-traversal problems inside the wrapper directory flow.
- Recommendation:
  - Enforce the same structural rules on the backend:
    - route must match `^/[a-z0-9_-]+$`
    - command name must match `^[a-zA-Z0-9_-]+$`
    - reject separators, dots, spaces, and traversal patterns
  - Treat the frontend validator as UX only, not as security.

### 4. High: settings and command result contracts are inconsistent between frontend and backend

- Files:
  - `src-tauri/src/commands/settings.rs:6-100`
  - `src-tauri/src/commands/proxy.rs:10-16`
  - `src-tauri/src/commands/wrapper.rs:7-12`
  - `src/lib/api.ts:277-323`
  - `src/lib/types.ts:39-88`
  - `src/components/settings/SettingsModal.tsx:19-35`
- Problem:
  - Backend serializes fields in snake_case, for example `proxy_host`, `active_routes`, `command_name`.
  - Frontend `getSettings`, `getProxyStatus`, `generateWrapper`, and `updateSettings` mostly assume camelCase objects.
  - `update_settings` also expects snake_case input fields but the frontend sends camelCase.
- Impact:
  - Settings screen can show defaults instead of persisted values.
  - Settings saves can silently fail or partially fail.
  - Wrapper/proxy data shapes are inconsistent and fragile for future UI usage.
- Recommendation:
  - Normalize the contract in one place:
    - either add serde rename rules on Rust DTOs
    - or consistently convert all invoke payloads/results in `src/lib/api.ts`

### 5. High: setting a default profile can clear the existing default even when the target profile does not exist

- Files:
  - `src-tauri/src/commands/profile.rs:155-168`
  - `src-tauri/src/db/mod.rs:255-259`
- Problem:
  - `set_default_profile` clears all defaults first, then tries to set the requested id.
  - If the id is stale or invalid, the command returns `"Profile not found"` only after the old default is already removed.
- Impact:
  - A single bad call can leave the system with no default profile at all.
- Recommendation:
  - Verify target existence first, then change state in one transaction.

### 6. High: provider connectivity test is hardcoded to the wrong endpoint shape for many providers

- Files:
  - `src-tauri/src/services/provider_service.rs:50-80`
- Problem:
  - `OpenaiCompatible` and `Custom` are forced to `.../v4/chat/completions`.
  - Most OpenAI-compatible services use `/v1/chat/completions`, not `/v4/...`.
  - `Custom` is treated as OpenAI-compatible without any custom routing rule.
- Impact:
  - Test Connection will produce false negatives for valid providers.
  - Users can save a provider that works in real traffic but always looks broken in the test flow, or the opposite.
- Recommendation:
  - Endpoint selection must be provider-type aware and not hardcoded to a GLM-style path for all non-Anthropic providers.

### 7. Medium: the provider card "Test" action does not actually test anything

- Files:
  - `src/components/provider/ProviderList.tsx:47-50`
  - `src/components/provider/ProviderCard.tsx:65-74`
- Problem:
  - Clicking the card test icon only selects the provider; it never calls the test mutation.
- Impact:
  - The UI exposes an affordance that looks functional but does nothing beyond selection.
- Recommendation:
  - Either trigger the real test flow from the card or remove the icon from the card and keep testing only in the detail panel.

### 8. Medium: Add Profile modal does not reliably populate the model from the selected provider

- Files:
  - `src/components/profile/AddProfileModal.tsx:41-52`
  - `src/components/profile/AddProfileModal.tsx:140-147`
- Problem:
  - The model input only uses `placeholder` and `defaultValue`.
  - Changing provider does not actively write the provider's default model into form state.
- Impact:
  - Users can end up submitting an empty model even after selecting a provider.
  - The UI suggests auto-fill behavior that is not actually guaranteed.
- Recommendation:
  - When `providerId` changes, explicitly update the form value if the model field is still empty or untouched.

### 9. Medium: URL validation allows scheme-less values that the backend cannot actually use

- Files:
  - `src/lib/validators.ts:6-22`
  - `src-tauri/src/services/provider_service.rs:84-95`
  - `src-tauri/src/proxy/server.rs:168-170`
- Problem:
  - Frontend validator accepts values like `api.example.com` or `localhost`.
  - Backend request code relies on real URLs with `http://` or `https://`.
- Impact:
  - Users can pass validation and still hit runtime connection failures that feel unexplained.
- Recommendation:
  - Require explicit scheme in validation, or normalize inputs before save/test.

### 10. Medium: wrapper status check ignores configured wrapper directory

- Files:
  - `src-tauri/src/services/wrapper_service.rs:94-127`
- Problem:
  - `check_status()` always checks `~/.local/bin`, even though `generate()` reads `settings.wrapper_dir`.
- Impact:
  - After users customize wrapper output location, status checks become incorrect.
- Recommendation:
  - Read the same settings source for both generation and status inspection.

### 11. Medium: form state in settings/edit modals is initialized from async data but not resynced after load

- Files:
  - `src/components/settings/SettingsModal.tsx:19-22`
  - `src/components/provider/EditProviderModal.tsx:35-47`
  - `src/components/profile/EditProfileModal.tsx:30-41`
- Problem:
  - Local state and `useForm` default values are derived from async query data only on first render.
  - If the modal opens before data is ready, the form can stay stale or empty.
- Impact:
  - Users may see incorrect defaults and accidentally overwrite real values.
- Recommendation:
  - Reset form/local state in an effect when source data becomes available.

### 12. Low: frontend dependency audit already reports moderate known issues in the dev toolchain

- Files:
  - `package.json`
  - `package-lock.json`
- Evidence:
  - `npm audit` reported moderate advisories affecting `vite` and `esbuild`.
- Impact:
  - This is not the main runtime bug source, but it is engineering debt worth tracking.
- Recommendation:
  - Review upgrade path for Vite when broader refactoring is planned.

## Suggested Fix Order

1. Fix live proxy config reload semantics.
2. Fix mandatory local-token enforcement.
3. Harden backend validation for `route_path` and `command_name`.
4. Unify frontend-backend field contracts for settings/proxy/wrapper data.
5. Make default-profile change transactional and existence-safe.
6. Fix provider connection test endpoint logic.
7. Clean up UI behavior issues and form edge cases.

## Summary

- Frontend build is healthy after installing dependencies.
- The highest-risk issues are not cosmetic; they sit in the proxy control path, auth path, and backend validation path.
- The most important bug is that runtime config reload currently appears to work but does not reliably affect live traffic.
