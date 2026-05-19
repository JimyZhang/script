/*
new Env('极核-ZEEHO 青龙变量同步');

@Description:
抓取 ZEEHO App “我的”接口数据，并同步更新青龙环境变量 zeeho_data。

Loon 配置示例：
[Script]
http-response ^https:\/\/tapi\.zeehoev\.com\/v1\.0\/mine\/cfmotoservermine\/setting script-path=https://raw.githubusercontent.com/JimyZhang/script/refs/heads/main/script/zeeho/zeeho_ql_cookie.js, requires-body=true, timeout=60, tag=极核青龙变量同步

[MITM]
hostname = tapi.zeehoev.com

配置项：
- zeeho_ql_baseurl：青龙地址，默认 https://127.0.0.1:5700
- zeeho_ql_client_id：青龙应用 client_id
- zeeho_ql_client_secret：青龙应用 client_secret
- zeeho_ql_env_name：青龙环境变量名，默认 zeeho_data
- zeeho_ql_env_remarks：青龙环境变量备注，默认 极核-ZEEHO
*/

const $ = new Env("极核-ZEEHO 青龙变量同步");

const DEFAULT_QL_BASEURL = "https://127.0.0.1:5700";
const DEFAULT_ENV_NAME = "zeeho_data";
const DEFAULT_ENV_REMARKS = "极核-ZEEHO";

!(async () => {
  if (typeof $request === "undefined" || typeof $response === "undefined") {
    $.log("请在 HTTP Response 抓包场景中运行此脚本");
    return;
  }

  if ($request.method === "OPTIONS") return;

  const config = getConfig();
  if (!config.clientId || !config.clientSecret) {
    $.msg($.name, "❌配置缺失", "请配置 zeeho_ql_client_id 和 zeeho_ql_client_secret");
    return;
  }

  const account = parseZeehoAccount();
  if (!account) return;

  const qlToken = await getQlToken(config);
  if (!qlToken) return;

  const envs = await getQlEnvs(config, qlToken);
  if (!envs) return;

  const currentEnv = findEnv(envs, config.envName);
  const nextValue = buildNextEnvValue(currentEnv?.value, account);
  const ok = currentEnv
    ? await updateQlEnv(config, qlToken, currentEnv, nextValue)
    : await createQlEnv(config, qlToken, nextValue);

  if (ok) {
    $.msg($.name, `🎉${account.userName} 同步青龙成功`, config.envName);
  }
})()
  .catch((e) => {
    $.log(`❌运行失败：${e.message || e}`);
    $.msg($.name, "❌运行失败", e.message || String(e));
  })
  .finally(() => $.done({ ok: 1 }));

function getConfig() {
  return {
    baseUrl: trimEndSlash($.getdata("zeeho_ql_baseurl") || DEFAULT_QL_BASEURL),
    clientId: $.getdata("zeeho_ql_client_id") || "",
    clientSecret: $.getdata("zeeho_ql_client_secret") || "",
    envName: $.getdata("zeeho_ql_env_name") || DEFAULT_ENV_NAME,
    remarks: $.getdata("zeeho_ql_env_remarks") || DEFAULT_ENV_REMARKS
  };
}

function parseZeehoAccount() {
  const header = ObjectKeys2LowerCase($request.headers || {});
  const token = header["authorization"];
  const userAgent = header["user-agent"];
  const body = $.toObj($response.body);

  if (!token || !userAgent) {
    $.msg($.name, "❌获取失败", "请求头缺少 Authorization 或 User-Agent");
    return null;
  }

  if (!body?.data?.id) {
    $.msg($.name, "❌获取失败", "响应体缺少 data.id");
    return null;
  }

  return {
    userId: String(body.data.id),
    token,
    userName: body.data.nickName || body.data.nickname || `ZEEHO_${body.data.id}`,
    userAgent
  };
}

async function getQlToken(config) {
  const url = `${config.baseUrl}/open/auth/token?client_id=${encodeURIComponent(config.clientId)}&client_secret=${encodeURIComponent(config.clientSecret)}`;
  const res = await httpRequest({ url, method: "get" });
  const token = res?.data?.token || res?.data;

  if (!token) {
    $.msg($.name, "❌青龙认证失败", res?.message || "未获取到 token");
    return null;
  }

  return token;
}

async function getQlEnvs(config, token) {
  const url = `${config.baseUrl}/open/envs?searchValue=${encodeURIComponent(config.envName)}`;
  const res = await httpRequest({
    url,
    method: "get",
    headers: buildQlHeaders(token)
  });

  if (!isQlOk(res)) {
    $.msg($.name, "❌查询青龙变量失败", res?.message || $.toStr(res));
    return null;
  }

  return Array.isArray(res.data) ? res.data : [];
}

async function updateQlEnv(config, token, env, value) {
  const envId = getEnvId(env);
  if (!envId) {
    $.msg($.name, "❌更新青龙变量失败", `变量 ${config.envName} 缺少 id/_id`);
    $.log(`青龙变量返回字段：${Object.keys(env || {}).join(",")}`);
    return false;
  }

  const payload = {
    id: envId,
    name: config.envName,
    value,
    remarks: env.remarks || config.remarks
  };
  const res = await httpRequest({
    url: `${config.baseUrl}/open/envs`,
    method: "put",
    headers: buildQlHeaders(token),
    body: payload
  });

  if (!isQlOk(res)) {
    $.msg($.name, "❌更新青龙变量失败", res?.message || $.toStr(res));
    return false;
  }

  return true;
}

async function createQlEnv(config, token, value) {
  const payload = [{
    name: config.envName,
    value,
    remarks: config.remarks
  }];
  const res = await httpRequest({
    url: `${config.baseUrl}/open/envs`,
    method: "post",
    headers: buildQlHeaders(token),
    body: payload
  });

  if (!isQlOk(res)) {
    $.msg($.name, "❌创建青龙变量失败", res?.message || $.toStr(res));
    return false;
  }

  return true;
}

function buildNextEnvValue(oldValue, account) {
  let list = $.toObj(oldValue);
  if (!Array.isArray(list)) list = [];

  const index = list.findIndex((item) => String(item.userId) === String(account.userId));
  if (index >= 0) {
    list[index] = account;
  } else {
    list.push(account);
  }

  return JSON.stringify(list, null, 2);
}

function findEnv(envs, name) {
  return envs.find((env) => env.name === name);
}

function getEnvId(env) {
  return env?.id ?? env?._id;
}

function buildQlHeaders(token) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json;charset=UTF-8"
  };
}

function isQlOk(res) {
  return res?.code === 200 || res?.code === 0;
}

function trimEndSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function ObjectKeys2LowerCase(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
}

function httpRequest(options) {
  const method = (options.method || "get").toLowerCase();
  const request = {
    url: options.url,
    headers: options.headers || {},
    timeout: options.timeout || 15000
  };

  if (options.body !== undefined) {
    request.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  return new Promise((resolve, reject) => {
    $.http[method](request)
      .then((response) => resolve($.toObj(response.body) || response.body))
      .catch((err) => reject(err));
  });
}

function Env(t, e) {
  class Http {
    constructor(env) {
      this.env = env;
    }

    get(options) {
      return this.send(options, "GET");
    }

    post(options) {
      return this.send(options, "POST");
    }

    put(options) {
      return this.send({ ...options, method: "PUT" }, "PUT");
    }

    send(options, method = "GET") {
      const request = typeof options === "string" ? { url: options } : options;
      return new Promise((resolve, reject) => {
        if (this.env.isQuanX()) {
          request.method = method;
          $task.fetch(request).then(resolve, reject);
        } else {
          const methodName = method.toLowerCase();
          const fn = typeof $httpClient[methodName] === "function"
            ? methodName
            : method === "GET" ? "get" : "post";
          if (fn === "post" && method !== "POST") request.method = method;
          $httpClient[fn](request, (err, response, body) => {
            if (err) {
              reject(err);
            } else {
              response.body = body;
              resolve(response);
            }
          });
        }
      });
    }
  }

  return new class {
    constructor(name, opts) {
      this.name = name;
      this.http = new Http(this);
      Object.assign(this, opts);
      this.log("", `🔔${this.name}, 开始!`);
    }

    isQuanX() {
      return typeof $task !== "undefined";
    }

    getdata(key) {
      if (this.isQuanX()) return $prefs.valueForKey(key);
      return $persistentStore.read(key);
    }

    toObj(value, fallback = null) {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }

    toStr(value, fallback = null) {
      try {
        return JSON.stringify(value);
      } catch {
        return fallback;
      }
    }

    msg(title, subtitle = "", message = "") {
      if (this.isQuanX()) {
        $notify(title, subtitle, message);
      } else {
        $notification.post(title, subtitle, message);
      }
      this.log(title, subtitle, message);
    }

    log(...args) {
      console.log(args.join("\n"));
    }

    done(value = {}) {
      if (typeof $done !== "undefined") $done(value);
    }
  }(t, e);
}
