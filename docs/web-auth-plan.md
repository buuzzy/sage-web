# Sage Web 登录与认证方案

## 目标

Web 版只保留浏览器原生 OAuth 登录链路，不再使用 macOS deep-link。

## 当前策略

- 登录提供 GitHub / Google OAuth。
- OAuth redirect 回到 `/login`。
- `AuthProvider` 通过 `supabase.auth.getSession()` 和 `onAuthStateChange()` 恢复会话。
- 登录成功后 `LoginPage` 自动跳转到 `/`。
- 本地缓存继续沿用 IndexedDB + Supabase 同步，保留 `dbReady` 作为页面守卫状态。

## 与 macOS 版的差异

| 项目 | macOS | Web |
|---|---|---|
| OAuth 打开方式 | 系统浏览器 | 当前浏览器页 |
| 回调方式 | `sage://auth/callback` deep-link | `/login` 页面 |
| Session 恢复 | deep-link + Supabase session | Supabase session |
| 更新/安装链路 | Tauri updater | 暂不支持 |

## 后续检查项

1. Supabase OAuth Redirect URLs 需要包含：
   - 本地：`http://localhost:1420/login`
   - 线上：正式 web 域名 `/login`
2. 如果部署平台不是根域名，需要确认 `window.location.origin + '/login'` 是否仍正确。
3. Web 版暂不支持 email/password 注册入口，代码保留 `signInWithEmail` 作为后续扩展。
