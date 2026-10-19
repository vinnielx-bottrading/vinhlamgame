/**
 * ============================================================================
 *  VINH LÀM GAME — Cloudflare Worker: tải lên & phát hình / video từ Backblaze B2 (bucket PRIVATE)
 *  BẢN DÁN TRỰC TIẾP VÀO DASHBOARD (1 file, không cần npm, không cần wrangler, không cần thẻ thanh toán)
 * ============================================================================
 *  1. Cloudflare Dashboard › Workers & Pages › Create › Create Worker › đặt tên "vinhlamgame" › Deploy (đã tạo: https://vinhlamgame.vinnielx.workers.dev)
 *  2. Bấm "Edit code" › xoá hết code mẫu › dán TOÀN BỘ file này › Deploy
 *  3. Worker › Settings › Variables and Secrets › Add:
 *       Text   B2_BUCKET          tên bucket private, vd: vinhlamgame-media
 *       Text   B2_ENDPOINT        s3.us-west-004.backblazeb2.com      (B2 › Buckets › Endpoint, bỏ https://)
 *       Text   B2_REGION          us-west-004                          (phần giữa của endpoint)
 *       Text   ALLOWED_ORIGINS    https://vinhlamgame.vercel.app       (tên miền chạy admin, cách nhau dấu phẩy)
 *       Text   SUPABASE_URL       https://yzyepdkzownfajvqmzbf.supabase.co
 *       Text   SUPABASE_ANON_KEY  sb_publishable_bFh-bM6FkvlbIDSDsfX4pA_B7wDMZ2k
 *       Secret B2_KEY_ID          keyID của Application Key (quyền Read and Write, chỉ bucket này)
 *       Secret B2_APP_KEY         applicationKey
 *     Không bắt buộc:
 *       Secret SUPABASE_SERVICE_ROLE_KEY   để gửi email mời quản trị viên
 *       Text   MAX_UPLOAD_MB      95
 *       Text   PRESIGN_EXPIRES    900
 *       Text   MEDIA_CACHE_SECONDS 31536000
 *       Text   PUBLIC_BASE_URL    chỉ khi có tên miền riêng trỏ vào Worker, vd https://media.ten-mien.com/media
 *     KHÔNG cần CORS trên bucket B2 (để "Do not share any files with any origin"): admin gửi file qua Worker.
 *     Mỗi file tối đa ~95 MB (giới hạn request của Cloudflare Free).
 *  4. Mở  https://<worker>.workers.dev/health  → thấy "ok": true là xong.
 *     File tải lên sẽ có link dạng  https://<worker>.workers.dev/media/banner/images/2026/10/ten-file-a1b2c3d4.jpg
 *  5. Dán địa chỉ Worker vào UPLOAD_WORKER_URL trong admin.html.
 *
 *  Phần dưới gồm thư viện aws4fetch (MIT, ký request S3) đã gộp sẵn + code Worker.
 * ============================================================================
 */
// node_modules/aws4fetch/dist/aws4fetch.esm.mjs
var encoder = new TextEncoder();
var HOST_SERVICES = {
  appstream2: "appstream",
  cloudhsmv2: "cloudhsm",
  email: "ses",
  marketplace: "aws-marketplace",
  mobile: "AWSMobileHubService",
  pinpoint: "mobiletargeting",
  queue: "sqs",
  "git-codecommit": "codecommit",
  "mturk-requester-sandbox": "mturk-requester",
  "personalize-runtime": "personalize"
};
var UNSIGNABLE_HEADERS = /* @__PURE__ */ new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
  "x-amzn-trace-id",
  "range",
  "connection"
]);
var AwsClient = class {
  constructor({ accessKeyId, secretAccessKey, sessionToken, service, region, cache, retries, initRetryMs }) {
    if (accessKeyId == null)
      throw new TypeError("accessKeyId is a required option");
    if (secretAccessKey == null)
      throw new TypeError("secretAccessKey is a required option");
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.service = service;
    this.region = region;
    this.cache = cache || /* @__PURE__ */ new Map();
    this.retries = retries != null ? retries : 10;
    this.initRetryMs = initRetryMs || 50;
  }
  async sign(input, init) {
    if (input instanceof Request) {
      const { method, url, headers, body } = input;
      init = Object.assign({ method, url, headers }, init);
      if (init.body == null && headers.has("Content-Type")) {
        init.body = body != null && headers.has("X-Amz-Content-Sha256") ? body : await input.clone().arrayBuffer();
      }
      input = url;
    }
    const signer = new AwsV4Signer(Object.assign({ url: input.toString() }, init, this, init && init.aws));
    const signed = Object.assign({}, init, await signer.sign());
    delete signed.aws;
    try {
      return new Request(signed.url.toString(), signed);
    } catch (e) {
      if (e instanceof TypeError) {
        return new Request(signed.url.toString(), Object.assign({ duplex: "half" }, signed));
      }
      throw e;
    }
  }
  async fetch(input, init) {
    for (let i = 0; i <= this.retries; i++) {
      const fetched = fetch(await this.sign(input, init));
      if (i === this.retries) {
        return fetched;
      }
      const res = await fetched;
      if (res.status < 500 && res.status !== 429) {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.random() * this.initRetryMs * Math.pow(2, i)));
    }
    throw new Error("An unknown error occurred, ensure retries is not negative");
  }
};
var AwsV4Signer = class {
  constructor({ method, url, headers, body, accessKeyId, secretAccessKey, sessionToken, service, region, cache, datetime, signQuery, appendSessionToken, allHeaders, singleEncode }) {
    if (url == null)
      throw new TypeError("url is a required option");
    if (accessKeyId == null)
      throw new TypeError("accessKeyId is a required option");
    if (secretAccessKey == null)
      throw new TypeError("secretAccessKey is a required option");
    this.method = method || (body ? "POST" : "GET");
    this.url = new URL(url);
    this.headers = new Headers(headers || {});
    this.body = body;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    let guessedService, guessedRegion;
    if (!service || !region) {
      [guessedService, guessedRegion] = guessServiceRegion(this.url, this.headers);
    }
    this.service = service || guessedService || "";
    this.region = region || guessedRegion || "us-east-1";
    this.cache = cache || /* @__PURE__ */ new Map();
    this.datetime = datetime || (/* @__PURE__ */ new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
    this.signQuery = signQuery;
    this.appendSessionToken = appendSessionToken || this.service === "iotdevicegateway";
    this.headers.delete("Host");
    if (this.service === "s3" && !this.signQuery && !this.headers.has("X-Amz-Content-Sha256")) {
      this.headers.set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD");
    }
    const params = this.signQuery ? this.url.searchParams : this.headers;
    params.set("X-Amz-Date", this.datetime);
    if (this.sessionToken && !this.appendSessionToken) {
      params.set("X-Amz-Security-Token", this.sessionToken);
    }
    this.signableHeaders = ["host", ...this.headers.keys()].filter((header) => allHeaders || !UNSIGNABLE_HEADERS.has(header)).sort();
    this.signedHeaders = this.signableHeaders.join(";");
    this.canonicalHeaders = this.signableHeaders.map((header) => header + ":" + (header === "host" ? this.url.host : (this.headers.get(header) || "").replace(/\s+/g, " "))).join("\n");
    this.credentialString = [this.datetime.slice(0, 8), this.region, this.service, "aws4_request"].join("/");
    if (this.signQuery) {
      if (this.service === "s3" && !params.has("X-Amz-Expires")) {
        params.set("X-Amz-Expires", "86400");
      }
      params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
      params.set("X-Amz-Credential", this.accessKeyId + "/" + this.credentialString);
      params.set("X-Amz-SignedHeaders", this.signedHeaders);
    }
    if (this.service === "s3") {
      try {
        this.encodedPath = decodeURIComponent(this.url.pathname.replace(/\+/g, " "));
      } catch (e) {
        this.encodedPath = this.url.pathname;
      }
    } else {
      this.encodedPath = this.url.pathname.replace(/\/+/g, "/");
    }
    if (!singleEncode) {
      this.encodedPath = encodeURIComponent(this.encodedPath).replace(/%2F/g, "/");
    }
    this.encodedPath = encodeRfc3986(this.encodedPath);
    const seenKeys = /* @__PURE__ */ new Set();
    this.encodedSearch = [...this.url.searchParams].filter(([k]) => {
      if (!k)
        return false;
      if (this.service === "s3") {
        if (seenKeys.has(k))
          return false;
        seenKeys.add(k);
      }
      return true;
    }).map((pair) => pair.map((p) => encodeRfc3986(encodeURIComponent(p)))).sort(([k1, v1], [k2, v2]) => k1 < k2 ? -1 : k1 > k2 ? 1 : v1 < v2 ? -1 : v1 > v2 ? 1 : 0).map((pair) => pair.join("=")).join("&");
  }
  async sign() {
    if (this.signQuery) {
      this.url.searchParams.set("X-Amz-Signature", await this.signature());
      if (this.sessionToken && this.appendSessionToken) {
        this.url.searchParams.set("X-Amz-Security-Token", this.sessionToken);
      }
    } else {
      this.headers.set("Authorization", await this.authHeader());
    }
    return {
      method: this.method,
      url: this.url,
      headers: this.headers,
      body: this.body
    };
  }
  async authHeader() {
    return [
      "AWS4-HMAC-SHA256 Credential=" + this.accessKeyId + "/" + this.credentialString,
      "SignedHeaders=" + this.signedHeaders,
      "Signature=" + await this.signature()
    ].join(", ");
  }
  async signature() {
    const date = this.datetime.slice(0, 8);
    const cacheKey = [this.secretAccessKey, date, this.region, this.service].join();
    let kCredentials = this.cache.get(cacheKey);
    if (!kCredentials) {
      const kDate = await hmac("AWS4" + this.secretAccessKey, date);
      const kRegion = await hmac(kDate, this.region);
      const kService = await hmac(kRegion, this.service);
      kCredentials = await hmac(kService, "aws4_request");
      this.cache.set(cacheKey, kCredentials);
    }
    return buf2hex(await hmac(kCredentials, await this.stringToSign()));
  }
  async stringToSign() {
    return [
      "AWS4-HMAC-SHA256",
      this.datetime,
      this.credentialString,
      buf2hex(await hash(await this.canonicalString()))
    ].join("\n");
  }
  async canonicalString() {
    return [
      this.method.toUpperCase(),
      this.encodedPath,
      this.encodedSearch,
      this.canonicalHeaders + "\n",
      this.signedHeaders,
      await this.hexBodyHash()
    ].join("\n");
  }
  async hexBodyHash() {
    let hashHeader = this.headers.get("X-Amz-Content-Sha256") || (this.service === "s3" && this.signQuery ? "UNSIGNED-PAYLOAD" : null);
    if (hashHeader == null) {
      if (this.body && typeof this.body !== "string" && !("byteLength" in this.body)) {
        throw new Error("body must be a string, ArrayBuffer or ArrayBufferView, unless you include the X-Amz-Content-Sha256 header");
      }
      hashHeader = buf2hex(await hash(this.body || ""));
    }
    return hashHeader;
  }
};
async function hmac(key, string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? encoder.encode(key) : key,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(string));
}
async function hash(content) {
  return crypto.subtle.digest("SHA-256", typeof content === "string" ? encoder.encode(content) : content);
}
var HEX_CHARS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
function buf2hex(arrayBuffer) {
  const buffer = new Uint8Array(arrayBuffer);
  let out = "";
  for (let idx = 0; idx < buffer.length; idx++) {
    const n = buffer[idx];
    out += HEX_CHARS[n >>> 4 & 15];
    out += HEX_CHARS[n & 15];
  }
  return out;
}
function encodeRfc3986(urlEncodedStr) {
  return urlEncodedStr.replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function guessServiceRegion(url, headers) {
  const { hostname, pathname } = url;
  if (hostname.endsWith(".on.aws")) {
    const match2 = hostname.match(/^[^.]{1,63}\.lambda-url\.([^.]{1,63})\.on\.aws$/);
    return match2 != null ? ["lambda", match2[1] || ""] : ["", ""];
  }
  if (hostname.endsWith(".r2.cloudflarestorage.com")) {
    return ["s3", "auto"];
  }
  if (hostname.endsWith(".backblazeb2.com")) {
    const match2 = hostname.match(/^(?:[^.]{1,63}\.)?s3\.([^.]{1,63})\.backblazeb2\.com$/);
    return match2 != null ? ["s3", match2[1] || ""] : ["", ""];
  }
  const match = hostname.replace("dualstack.", "").match(/([^.]{1,63})\.(?:([^.]{0,63})\.)?amazonaws\.com(?:\.cn)?$/);
  let service = match && match[1] || "";
  let region = match && match[2];
  if (region === "us-gov") {
    region = "us-gov-west-1";
  } else if (region === "s3" || region === "s3-accelerate") {
    region = "us-east-1";
    service = "s3";
  } else if (service === "iot") {
    if (hostname.startsWith("iot.")) {
      service = "execute-api";
    } else if (hostname.startsWith("data.jobs.iot.")) {
      service = "iot-jobs-data";
    } else {
      service = pathname === "/mqtt" ? "iotdevicegateway" : "iotdata";
    }
  } else if (service === "autoscaling") {
    const targetPrefix = (headers.get("X-Amz-Target") || "").split(".")[0];
    if (targetPrefix === "AnyScaleFrontendService") {
      service = "application-autoscaling";
    } else if (targetPrefix === "AnyScaleScalingPlannerFrontendService") {
      service = "autoscaling-plans";
    }
  } else if (region == null && service.startsWith("s3-")) {
    region = service.slice(3).replace(/^fips-|^external-1/, "");
    service = "s3";
  } else if (service.endsWith("-fips")) {
    service = service.slice(0, -5);
  } else if (region && /-\d$/.test(service) && !/-\d$/.test(region)) {
    [service, region] = [region, service];
  }
  return [HOST_SERVICES[service] || service, region || ""];
}

// src/index.js
var IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
var VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
var EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov"
};
var FOLDERS = ["banner", "games", "ads", "misc", "donate", "library"];
var src_default = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/media/") && (req.method === "GET" || req.method === "HEAD"))
      return serveMedia(req, env, ctx, url);
    if (url.pathname.startsWith("/media/") && req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: MEDIA_CORS });
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    try {
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (path === "/health" && req.method === "GET") {
        const missing = ["B2_KEY_ID", "B2_APP_KEY", "B2_BUCKET", "B2_ENDPOINT", "B2_REGION", "SUPABASE_URL", "SUPABASE_ANON_KEY"].filter((k) => !env[k]);
        return json({ ok: missing.length === 0, missing, mediaBase: mediaBase(env, url), invite: !!env.SUPABASE_SERVICE_ROLE_KEY, maxUploadMb: maxMb(env) }, 200, cors);
      }
      const admin = await requireAdmin(req, env);
      if (path === "/presign" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { key, contentType } = buildKey(body, env);
        const target = objectUrl(env, key);
        target.searchParams.set("X-Amz-Expires", String(Number(env.PRESIGN_EXPIRES || 900)));
        const signed = await b2(env).sign(new Request(target, { method: "PUT", headers: { "Content-Type": contentType } }), {
          aws: { signQuery: true, allHeaders: false }
        });
        return json({
          uploadUrl: signed.url,
          method: "PUT",
          headers: { "Content-Type": contentType },
          key,
          publicUrl: publicUrl(env, url, key),
          expiresIn: Number(env.PRESIGN_EXPIRES || 900),
          by: admin.email
        }, 200, cors);
      }
      if (path === "/upload" && (req.method === "PUT" || req.method === "POST")) {
        const contentType = (req.headers.get("Content-Type") || "").split(";")[0].trim();
        const size = Number(req.headers.get("Content-Length") || 0);
        const { key } = buildKey({ filename: url.searchParams.get("filename"), folder: url.searchParams.get("folder"), contentType, size }, env);
        if (!size)
          throw httpError(411, "Thi\u1EBFu dung l\u01B0\u1EE3ng file (Content-Length)");
        let body;
        if (typeof FixedLengthStream !== "undefined" && req.body) {
          const { readable, writable } = new FixedLengthStream(size);
          req.body.pipeTo(writable).catch(() => {
          });
          body = readable;
        } else {
          body = await req.arrayBuffer();
        }
        const signed = await b2(env).sign(objectUrl(env, key).toString(), {
          method: "PUT",
          body,
          headers: { "Content-Type": contentType, "Content-Length": String(size), "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD" }
        });
        const res = await fetch(signed);
        if (!res.ok)
          throw await b2Error(res);
        return json({ key, publicUrl: publicUrl(env, url, key) }, 200, cors);
      }
      if (path === "/file" && req.method === "DELETE") {
        const key = url.searchParams.get("key") || "";
        if (!validKey(key))
          throw httpError(400, "Key kh\xF4ng h\u1EE3p l\u1EC7");
        const res = await fetch(await b2(env).sign(objectUrl(env, key).toString(), { method: "DELETE" }));
        if (!res.ok && res.status !== 404)
          throw httpError(502, "Kh\xF4ng xo\xE1 \u0111\u01B0\u1EE3c file: " + res.status);
        return json({ deleted: key }, 200, cors);
      }
      if (path === "/admin/invite" && req.method === "POST") {
        if (!env.SUPABASE_SERVICE_ROLE_KEY)
          throw httpError(501, "Ch\u01B0a c\u1EA5u h\xECnh SUPABASE_SERVICE_ROLE_KEY tr\xEAn Worker");
        const { email, redirectTo } = await req.json().catch(() => ({}));
        const em = String(email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em))
          throw httpError(400, "Email kh\xF4ng h\u1EE3p l\u1EC7");
        const listed = await isListedAdmin(env, req.headers.get("Authorization"), em);
        if (!listed)
          throw httpError(400, "H\xE3y th\xEAm email v\xE0o danh s\xE1ch qu\u1EA3n tr\u1ECB vi\xEAn tr\u01B0\u1EDBc khi g\u1EEDi l\u1EDDi m\u1EDDi");
        const res = await fetch(`${env.SUPABASE_URL}/auth/v1/invite`, {
          method: "POST",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email: em, data: { invited_by: admin.email }, ...safeRedirect(redirectTo, env) ? { redirect_to: safeRedirect(redirectTo, env) } : {} })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = out.msg || out.message || out.error_description || "Kh\xF4ng g\u1EEDi \u0111\u01B0\u1EE3c l\u1EDDi m\u1EDDi";
          throw httpError(res.status === 422 ? 409 : 502, /already/i.test(msg) ? "Email n\xE0y \u0111\xE3 c\xF3 t\xE0i kho\u1EA3n. Ng\u01B0\u1EDDi \u0111\xF3 d\xF9ng \u201CQu\xEAn m\u1EADt kh\u1EA9u\u201D \u0111\u1EC3 \u0111\u1EB7t m\u1EADt kh\u1EA9u." : msg);
        }
        return json({ invited: em }, 200, cors);
      }
      throw httpError(404, "Kh\xF4ng c\xF3 endpoint n\xE0y");
    } catch (err) {
      return json({ error: err.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh" }, err.status || 500, cors);
    }
  }
};
function b2(env) {
  return new AwsClient({ accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APP_KEY, service: "s3", region: env.B2_REGION });
}
function objectUrl(env, key) {
  const host = env.B2_ENDPOINT.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return new URL(`https://${host}/${env.B2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`);
}
function mediaBase(env, url) {
  return (env.PUBLIC_BASE_URL || `${url.origin}/media`).replace(/\/+$/, "");
}
function publicUrl(env, url, key) {
  return `${mediaBase(env, url)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
var validKey = (k) => /^(banner|games|ads|misc|donate|library)\/(images|videos)\/\d{4}\/\d{2}\/[a-z0-9-]{1,80}\.[a-z0-9]{2,4}$/.test(k);
var MEDIA_CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "Range", "Access-Control-Max-Age": "86400" };
async function serveMedia(req, env, ctx, url) {
  let key;
  try {
    key = decodeURIComponent(url.pathname.slice("/media/".length));
  } catch {
    key = "";
  }
  if (!validKey(key))
    return new Response("Kh\xF4ng t\xECm th\u1EA5y file", { status: 404, headers: MEDIA_CORS });
  const ttl = Number(env.MEDIA_CACHE_SECONDS || 31536e3);
  const range = req.headers.get("Range");
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/media/${key}`, { method: "GET" });
  if (req.method === "GET" && !range) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit)
        return hit;
    } catch {
    }
  }
  const signed = await b2(env).sign(objectUrl(env, key).toString(), { method: req.method, headers: range ? { Range: range } : {} });
  const res = await fetch(signed, { cf: { cacheEverything: true, cacheTtl: ttl } });
  if (res.status === 404)
    return new Response("Kh\xF4ng t\xECm th\u1EA5y file", { status: 404, headers: MEDIA_CORS });
  if (!res.ok && res.status !== 206) {
    const t = await res.text().catch(() => "");
    const capped = /cap|exceeded|limit/i.test(t);
    return new Response(capped ? "B2 \u0111\xE3 h\u1EBFt h\u1EA1n m\u1EE9c t\u1EA3i xu\u1ED1ng mi\u1EC5n ph\xED trong ng\xE0y" : "Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c file t\u1EEB B2", { status: capped ? 503 : 502, headers: { ...MEDIA_CORS, "Retry-After": "3600", "Cache-Control": "no-store" } });
  }
  const h = new Headers(MEDIA_CORS);
  for (const k of ["content-type", "content-length", "content-range", "etag", "last-modified"]) {
    const v = res.headers.get(k);
    if (v)
      h.set(k, v);
  }
  h.set("Accept-Ranges", "bytes");
  h.set("Cache-Control", `public, max-age=${ttl}, immutable`);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox");
  h.set("Content-Disposition", "inline");
  const out = new Response(req.method === "HEAD" ? null : res.body, { status: res.status, headers: h });
  if (req.method === "GET" && !range && res.status === 200 && ctx?.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, out.clone()).catch(() => {
    }));
  }
  return out;
}
var maxMb = (env) => Number(env.MAX_UPLOAD_MB || 95);
function buildKey({ filename, contentType, size, folder }, env) {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(type))
    throw httpError(415, "Ch\u1EC9 nh\u1EADn \u1EA3nh (JPG, PNG, WebP, GIF, AVIF, SVG) ho\u1EB7c video (MP4, WebM, MOV)");
  const limit = maxMb(env) * 1024 * 1024;
  if (Number(size) > limit)
    throw httpError(413, `File l\u1EDBn h\u01A1n ${maxMb(env)} MB`);
  const dir = FOLDERS.includes(folder) ? folder : "misc";
  const kind = type.startsWith("video/") ? "videos" : "images";
  const base = String(filename || "file").replace(/\.[^.]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  const d = /* @__PURE__ */ new Date();
  const stamp = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const rand = crypto.getRandomValues(new Uint8Array(4)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  return { key: `${dir}/${kind}/${stamp}/${base}-${rand}.${EXT[type]}`, contentType: type };
}
async function requireAdmin(req, env) {
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth))
    throw httpError(401, "Ch\u01B0a \u0111\u0103ng nh\u1EADp");
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth } });
  if (!userRes.ok)
    throw httpError(401, "Phi\xEAn \u0111\u0103ng nh\u1EADp h\u1EBFt h\u1EA1n, h\xE3y \u0111\u0103ng nh\u1EADp l\u1EA1i");
  const user = await userRes.json();
  const rpc = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth, "Content-Type": "application/json" },
    body: "{}"
  });
  if (!rpc.ok || await rpc.json() !== true)
    throw httpError(403, "T\xE0i kho\u1EA3n n\xE0y kh\xF4ng ph\u1EA3i qu\u1EA3n tr\u1ECB vi\xEAn");
  return { email: String(user.email || "").toLowerCase(), id: user.id };
}
async function isListedAdmin(env, auth, email) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/admins?select=email&email=eq.${encodeURIComponent(email)}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth }
  });
  if (!r.ok)
    return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
}
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const list = allowedOrigins(env);
  const ok = list.includes("*") || list.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? list.includes("*") ? "*" : origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
function safeRedirect(u, env) {
  try {
    const x = new URL(u);
    return allowedOrigins(env).some((o) => o === "*" || o === x.origin) ? x.toString() : "";
  } catch {
    return "";
  }
}
function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
async function b2Error(res) {
  const t = await res.text().catch(() => "");
  const code = (t.match(/<Code>([^<]+)<\/Code>/) || [])[1] || "";
  const msg = (t.match(/<Message>([^<]+)<\/Message>/) || [])[1] || t.slice(0, 160);
  const hint = {
    InvalidAccessKeyId: "B2_KEY_ID sai ho\u1EB7c key \u0111\xE3 b\u1ECB xo\xE1.",
    SignatureDoesNotMatch: "B2_APP_KEY sai, ho\u1EB7c B2_REGION kh\xF4ng kh\u1EDBp v\u1EDBi B2_ENDPOINT.",
    AccessDenied: /cap|exceeded/i.test(msg) ? "\u0110\xE3 h\u1EBFt h\u1EA1n m\u1EE9c mi\u1EC5n ph\xED trong ng\xE0y c\u1EE7a B2." : "Application Key kh\xF4ng c\xF3 quy\u1EC1n ghi v\xE0o bucket n\xE0y (c\u1EA7n Read and Write, \u0111\xFAng bucket).",
    NoSuchBucket: "B2_BUCKET sai t\xEAn bucket.",
    InvalidRequest: "Endpoint ho\u1EB7c region kh\xF4ng \u0111\xFAng v\u1EDBi bucket.",
    ServiceUnavailable: "B2 \u0111ang b\u1EADn, h\xE3y th\u1EED l\u1EA1i sau \xEDt ph\xFAt.",
    SlowDown: "B2 \u0111ang b\u1EADn, h\xE3y th\u1EED l\u1EA1i sau \xEDt ph\xFAt.",
    InternalError: "B2 g\u1EB7p l\u1ED7i t\u1EA1m th\u1EDDi, h\xE3y th\u1EED l\u1EA1i."
  }[code] || "";
  const retry = res.status >= 500 || res.status === 429 || code === "SlowDown" || code === "ServiceUnavailable";
  const e = httpError(retry ? 503 : 502, `B2 b\xE1o l\u1ED7i ${res.status}${code ? " " + code : ""}: ${hint || msg}`);
  e.retry = retry;
  return e;
}
export {
  src_default as default
};
/*! Bundled license information:

aws4fetch/dist/aws4fetch.esm.mjs:
  (**
   * @license MIT <https://opensource.org/licenses/MIT>
   * @copyright Michael Hart 2024
   *)
*/
