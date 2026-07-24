# Sage Web

> Sage 的 web-first 版本，用于快速验证产品市场匹配（PMF）。

---

## 这个仓库做什么

Sage Web 的目标不是复制桌面壳，而是尽快验证：

- 谁会使用 Sage
- 他们会把它用在什么场景
- 哪些能力能带来持续留存
- 哪些功能值得继续投入

我们会优先保留：

- 对话与 Agent 执行
- 连续记忆
- 金融信息与图表能力
- Supabase 同步与账号体系
- 基础产品分析埋点

桌面端相关能力将暂时冻结在本地 macOS 项目中，不作为当前主线。

---

## 开发命令

```bash
pnpm install
pnpm dev
pnpm dev:api
pnpm dev:all
pnpm build
pnpm lint
pnpm format
```

---

## 当前迁移边界

### 已复用
- 前端页面与组件
- 后端 API 与 Agent 逻辑
- Supabase 数据模型
- 配置模板与公共资源

### 暂不迁移
- Tauri / macOS 桌面壳
- 签名、公证、安装包
- 本地文件系统与桌面专属交互
- updater / release 分发链路

---

## 下一步

1. 将 web 端入口跑通
2. 清理剩余桌面专属依赖
3. 收集真实用户反馈
4. 再决定是否重启 macOS 产品设计
