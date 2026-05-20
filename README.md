# loon-script

Loon 脚本与插件资源仓库，包含若干服务的自动化脚本、Loon 插件配置、图标资源和订阅 JSON。

## 目录结构

- `script/`：按服务分目录存放的 JavaScript 脚本。
- `qinglong/`：青龙专用脚本目录。
- `loon/plugin/`：Loon 插件配置文件。
- `icons/`：插件和订阅使用的 PNG 图标。
- `subscribe/`：图标订阅、BoxJS 等订阅 JSON。
- `.github/scripts/`：GitHub Actions 使用的辅助脚本。

## 使用说明

Loon 插件文件中的脚本地址通常指向本仓库 `main` 分支下的 GitHub raw URL。修改脚本路径、插件路径或图标文件名时，需要同步检查相关插件和订阅文件。

青龙脚本放在 `qinglong/`。这类脚本面向 Node.js/青龙环境运行，通常通过青龙环境变量传入账号数据，不依赖 Loon 的 `$request`/`$response` 抓包入口。

`script/zeeho/zeeho_ql_cookie.js` 用于在 Loon 抓取 ZEEHO 账号信息后同步到青龙 OpenAPI。使用前需要在 Loon/BoxJS 本地配置：

- `zeeho_ql_baseurl`：青龙地址，默认 `https://ql.joyzj.cn:4443`
- `zeeho_ql_client_id`：青龙应用 `client_id`
- `zeeho_ql_client_secret`：青龙应用 `client_secret`
- `zeeho_ql_env_name`：青龙环境变量名，默认 `zeeho_data`
- `zeeho_ql_env_remarks`：青龙环境变量备注，默认 `极核-ZEEHO`

也可以在 Loon 里手动运行一次下面的脚本，把值写入持久化存储：

```js
$persistentStore.write("https://ql.joyzj.cn:4443", "zeeho_ql_baseurl");
$persistentStore.write("你的client_id", "zeeho_ql_client_id");
$persistentStore.write("你的client_secret", "zeeho_ql_client_secret");
$persistentStore.write("zeeho_data", "zeeho_ql_env_name");
$persistentStore.write("极核-ZEEHO", "zeeho_ql_env_remarks");

$notification.post("ZEEHO青龙配置", "写入完成", "");
$done();
```

保存成一个 Loon 脚本，手动执行一次即可。之后 `zeeho_ql_cookie.js` 就能读到这些配置。

## 开发与验证

当前仓库没有包管理器清单，也没有定义自动化测试命令。

- 修改脚本后，至少检查 JavaScript 语法和运行环境变量名是否与插件配置一致。
- 修改插件后，确认 `script-path`、`hostname`、`cron` 和图标地址仍然有效。
- 修改 `icons/` 后，需要同步更新 `subscribe/leiyiyan.icons.json`，或确认 GitHub Actions 能够重新生成该文件。

## 协作规范

面向 Claude、Codex 等代码助手的项目说明维护在 [AGENTS.md](./AGENTS.md)。Claude 项目文件 [CLAUDE.md](./CLAUDE.md) 会直接引用该文件，避免重复维护。
