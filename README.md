# 京东家政
京东家政商品线报

在线访问：https://wh624.github.io/jdjz/

## 本地开发

```bash
npm install
npm run dev
```

## 数据更新脚本

商品数据存放在 `public/data/jdjz_products.json`，由 `scripts/update-products.mjs` 抓取线报源站生成（零依赖，Node 18+ 即可运行）。

```bash
npm run update:data        # 抓取并写入 public/data/jdjz_products.json
npm run update:data:dry    # 只抓取解析、打印统计，不落盘

# 也可直接调用，支持覆盖参数
node scripts/update-products.mjs --source=https://example.com/xxx --out=tmp.json
```

脚本行为：

- 解析出分类（`身体护理`、`洗发护发` 等）与每个商品的 `name / link / img / price / sku / clean（买X送Y小时）/ gift（额外赠品）/ regionLimited（限地域）`；
- 商品图统一转成 `s800x800` 大图；
- 若配置了京东联盟密钥，会把商品链接换成**自己账号**的推广短链（`u.jd.com/xxx`），失败的条目自动回退源站链接，不会中断任务；
- 解析数量低于阈值（默认 30 件）时**直接报错且不写文件**，避免源站改版把线上数据洗空；
- `keywords` 字段会沿用原 JSON 中已有的配置。

### 环境变量（全部来自 Repository secrets，脚本不含任何默认值）

脚本的换链由**京推推**完成：先拿账号密码登录拿到 `token`，再逐条调用京推推转链接口把 `u.jd.com` 链接换成你自己的推广短链。登录、取 Cookie、转链全部由脚本自动完成。

**所有变量都必须在仓库 `Settings → Secrets and variables → Actions → Secrets` 中配置（New repository secret）**，脚本内不写默认值；缺少必需项时脚本会直接报错退出，不会用错误配置覆盖线上数据。

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `JTT_USERNAME` | **必填** | 京推推登录手机号 |
| `JTT_PASSWORD` | **必填** | 京推推登录密码 |
| `JTT_UNION_ID` | **必填** | 京推推联盟 ID（unionId） |
| `JTT_POSITION_ID` | **必填** | 京推推推广位 ID（positionid） |
| `JDJZ_SOURCE_URL` | **必填** | 数据源页面地址 |
| `JDJZ_SOURCE_COOKIE` | 可选 | 源站需要登录/风控校验时填 Cookie 原文；留空则不附加 |
| `JDJZ_SOURCE_UA` | 可选 | 自定义 User-Agent；留空则用脚本内置 Chrome UA |
| `JDJZ_MIN_PRODUCTS` | 可选 | 最少商品数校验阈值（解析阶段与转链后都会校验），未设置时按 `30` 校验 |
| `JDJZ_IMAGE_SIZE` | 可选 | 商品图统一尺寸（`s800x800` 等），留空则保留源站原图 |

> 转链时若某条链接失败，脚本会**重试 2 次**，仍失败则删除该商品（与京推推换链话术一致）；转链后商品数低于阈值会直接中止写入并报警，避免误清空线上数据。
> 本地调试时把以上变量写到 `.env` 里自行 `export` 即可，`.env` 已在 `.gitignore` 中忽略。

## GitHub Actions 定时更新

- `.github/workflows/update-data.yml`：每天 **21:30（北京时间，即 13:30 UTC）** 自动执行脚本（抓取 → 登录京推推 → 转链 → 写回），数据有变化才提交 `public/data/jdjz_products.json`；也可在 Actions 页面点 `Run workflow` 手动触发。
  - 想改时间/加一次执行，编辑 `cron`（UTC 时间）：`- cron: '0 4 * * *'` 即 12:00 北京时间。
  - 需要 `Settings → Actions → General → Workflow permissions` 选择 **Read and write permissions**，否则机器人无法推送提交。
- `.github/workflows/deploy.yml`：`main` 分支有推送时构建并发布到 GitHub Pages；同时监听数据更新工作流的完成事件（`workflow_run`）**自动重新部署**，保证每次定时更新后页面都能拿到最新 JSON。
  - 部署使用 `workflow_run` 触发，是因为用 `GITHUB_TOKEN` 推送的提交不会触发普通的 `push` 事件。
