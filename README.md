# SnackOps

零食电商客服 Agent / Planner / Skill / Tool / Eval 运营平台骨架。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui 风格组件与 Radix UI
- lucide-react
- sonner
- recharts
- zod
- pnpm

## 脚本

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm validate
```

`pnpm dev` 和 `pnpm start` 默认使用 `5000` 端口，可通过 `DEPLOY_RUN_PORT` 覆盖。

## 数据目录

服务端 JSON 存储模块位于 `src/lib/store.ts`。数据目录优先读取 `SNACKOPS_DATA_DIR`，其次读取 `DATA_DIR`，否则使用项目根目录下的 `data/`。

客户端不直接读写 `data/` 文件；读写必须经过服务端模块或 API Route。

## 存储验收 API

```bash
POST /api/dev/store-check
GET /api/dev/store-check
```

`POST` 会对同一个 JSON 文件发起并发更新，用于验证进程级文件锁、临时文件写入和原子 rename。

## Railway 部署

当前项目可以部署到 Railway，但必须配置 Volume。SnackOps 使用服务端 JSON 文件保存 Skill、Tool、Run、Eval、评分和标注等可变数据；如果不挂载持久化磁盘，重新部署或重启后数据可能丢失。

已提供：

- `railway.json`：使用 Nixpacks 构建，启动命令为 `pnpm railway:start`，健康检查为 `/api/health`。
- `scripts/railway-start.mjs`：启动前把仓库中的 `data/*.json` 和 `skills/*.md` 初始化到 Railway Volume；已有文件不会被覆盖。
- `SNACKOPS_DATA_DIR`：服务端 JSON 数据目录。
- `SNACKOPS_SKILLS_DIR`：Skill Prompt 持久化目录。

建议在 Railway 中创建 Volume，并挂载到：

```bash
/data
```

然后配置变量：

```bash
SNACKOPS_RAILWAY_VOLUME_ROOT=/data/snackops
LLM_PROVIDER=classroom-fixture
```

如果使用 OpenAI-compatible / DeepSeek：

```bash
LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=你的密钥
OPENAI_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

如果使用 Coze：

```bash
LLM_PROVIDER=coze
COZE_API_TOKEN=你的密钥
COZE_BOT_ID=你的 Bot ID
```

Railway 会自动注入 `PORT`，`pnpm railway:start` 会监听该端口并绑定 `0.0.0.0`。
