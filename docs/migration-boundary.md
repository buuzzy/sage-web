# Sage Web 迁移边界

## 适合迁移到 Web 仓库的内容

- `src/`
- `src-api/`
- `supabase/`
- `configs/`
- `public/`
- `README.md`
- `PRIVACY.md`
- `docs/`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `vite.config.ts`
- `tsconfig*.json`
- `eslint.config.js`
- `components.json`
- `patches/`

## 暂时冻结在 macOS 仓库的内容

- `src-tauri/`
- `scripts/` 下所有桌面构建脚本
- `latest.json`
- `Sage.pkg`
- 签名、公证、证书、p12、p8、provisionprofile 等敏感文件
- 所有 Tauri 安装包 / updater 相关逻辑

## 迁移后优先清理的方向

- `@tauri-apps/*` 依赖
- deep-link 登录
- updater provider
- 本地文件系统访问
- 桌面路径与用户目录逻辑
- sidecar / native window 相关能力
