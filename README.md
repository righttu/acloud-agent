# acloud-agent · 远帆客服 Agent

[![部署到 Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/righttu/acloud/tree/main/acloud-agent)

中文演示界面，每个浏览器会话对应一个 SQLite Durable Object。模型通过 PiHarness 使用只读 MCP 工具、生成分析代码、发布周报、准备回复草稿。界面轮询显示持久会话、工具输入输出、代码、模型 usage、草稿和报告历史。

## 部署后

1. 在有 righttu.uk 的账号点击部署，或 `npm install && npm run deploy`。其他账号先调整 routes，保留 workers.dev 备用地址。需要开通 Workers AI、R2、Browser Run 和 Dynamic Workers 权限/付费计划。
2. `wrangler secret put ACLOUD_MCP_TOKEN`，填入 acloud-mcp-s 相同的机器令牌。可选设置 ACLOUD_SANDBOX_TOKEN。示例见 `.dev.vars.example`，不提交真实密钥。
3. 控制台创建 AI Gateway `acloud-gateway`，或调整 AI_GATEWAY_ID。网关调用失败会再尝试 Workers AI 直连，界面显示降级；此策略不是跨供应商模型容灾。
4. 分别部署 acloud-mcp-s 和可选的 acloud-sandbox，检查 MCP_URL、SANDBOX_URL。此 Worker 不会替你部署其他目录。
5. **用 Cloudflare Access 保护首页和 /api 路径**。这是合成数据演示，没有用户认证，持有会话 UUID 的人可访问会话、批准发送。批准人姓名只是演示记录，不是可信身份。报告 /reports/:id 公开可读，只能放模拟数据。API 有同源检查，但不能替代认证与限流。
6. 在控制台确认 cron 为 `0 1 * * MON`（Asia/Shanghai 周一09:00）。定时任务使用独立对象和 operationId 去重；固定分析2026-W45模拟数据，不冒充真实每周数据源。所有对象写同一 R2，首页可以查看自动报告。

## 演示

按首页「演示主线」从上至下点击，按钮会填入提示词，再按发送。

| 步骤 | 观察 | 手册 |
|---|---|---|
| 1024号工单 | catalog发现参数，mcp_read查询 | 第4章，4.3令牌隔离 |
| 全周分析 | 模型生成JS，run_analysis日志包含代码和结果 | 第5章 |
| 模拟中断 | 对象真实abort，等约30秒刷新，Pi从SQLite检查点恢复 | 第6章 |
| 模型/技能 | 切换 GLM-4.7-Flash / Llama 3.3，构建时打包两份 Markdown 技能 | 第7章 |
| 发布、自检 | R2 HTML，浏览器打开页面并截图，报告及截图地址出现在工具结果 | 第8章 |
| 自动周报 | 周一上海09:00生成；历史列表 | 第9章 |
| Code Mode | 开关开启后模型使用mcp代码接口，一次执行只返回摘要 | 第10章 |
| 回复草稿 | 本地保存，填写批准人，人点击批准才调用submit_reply | 第11章 |
| Python复核 | 沙箱不可用时返回说明，不阻断对话 | 第5.5节 |

界面显示普通工具与 Code Mode 两次运行实际返回的 usage，不估算节省比例。两次运行应使用相同提示词与模型；会话历史不同会影响用量，不是严格基准。Pi 原始消息包含 usage 时才展示，没有返回就显示无数据。

## 组件与阶段、官方资料

- [Agents / PiHarness](https://developers.cloudflare.com/agents/harnesses/pi/)：agents 0.33.0、Pi 1.5.0 已在 npm 核实。使用 operationId、whenBusy followUp、只读工具 replay:safe。Pi Durable **实验性**，升级应向前修复，避免旧版本无法读取新存储格式。发送工具不注册到模型，模拟中断无需自建记步系统。
- [Pi AI provider](https://developers.cloudflare.com/agents/models/pi-ai/)：AI绑定、AI Gateway与usage。网关缺失时退回直连；降级提示在当前对象实例有效。
- [GLM-4.7-Flash](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/)（默认）与 [Llama 3.3 70B](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)：官方目录标注支持函数调用，目前没有计划停用日期。模型目录会变化，演示前请核对。
- [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/usage/bindings/)：globalOutbound:null，仅获得主Worker导出的AcloudWeekReader（ctx.exports），只读指定周的工单。没有把密钥、AI、R2绑定传进去。分析结果大小限制不等于防泄漏，模型代码仍可能返回原始数据；演示仅允许合成数据。
- [Code Mode](https://developers.cloudflare.com/agents/tools/codemode/api-reference/)：@cloudflare/codemode 0.5.6 DynamicWorkerExecutor。**实验性**，只包装固定只读MCP工具，写操作不进入代码接口。
- [Agents Browser](https://developers.cloudflare.com/agents/tools/browser/) / [Browser Rendering](https://developers.cloudflare.com/browser-run/puppeteer/)：Browser + browserRun，CDP导航、读取正文、截图存R2。限制域名为acloud-agent.righttu.uk；改域名时同步改guardrails和报告URL。浏览器配额不足返回未完成检查，不伪造通过。
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x/src/examples/client)：StreamableHTTPClientTransport，Bearer只在requestInit中。

## 接口约定和风险

只读白名单：get_ticket、list_tickets、search_tickets、get_customer、list_releases。模型先catalog取得实际参数schema；周数据绑定将2026-W45映射为week:45，调用list_tickets({week:45,limit:200,offset})并跟进next_offset至null。发送调用submit_reply({ticket_id,body,approver,request_id})，request_id为稳定草稿UUID。已对照MCP子项目PR契约；不支持的工具会明确失败而不是模拟成功。

发送先记录「发送中/结果待确认」，再外部调用，成功后记已发送。断网或对象中断造成结果不明时禁止自动重试，必须去工单系统核对，属于保守的至多一次尝试，不宣称跨服务恰好一次。自动周报和publish_report没有发送能力。草稿保存在会话对象，不写外部工单系统。

浏览器自检是正文可读性与截图检查，不是事实核验。发布内容经过HTML转义和CSP禁止脚本。报告历史最多列100个对象，工具日志最多展示100条，正式应用需加分页、保留策略、Access身份校验、用量限制和更完整审计。

## 检查

`npm run build` 将 skills Markdown打包进Worker；`npm run check` 生成绑定类型并运行 `tsc --noEmit`；`npm run dryrun` 构建并执行 Wrangler dry-run。无需package-lock，CI使用npm install。远程模型、MCP、浏览器和中断恢复仍需部署后联调，dry-run不能代替这些验证。
