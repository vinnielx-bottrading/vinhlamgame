/**
 * Vinh Làm Game — Cloudflare Worker: tải hình / video lên Backblaze B2
 *
 * Luồng tải lên mặc định (KHÔNG cần CORS trên bucket B2):
 *   admin.html PUT file lên  /upload  → Worker kiểm tra quản trị viên → Worker đẩy file lên B2 → trả publicUrl
 *   Giới hạn: mỗi file tối đa ~100 MB (giới hạn request của Cloudflare gói Free).
 * Luồng phụ  /presign  (trình duyệt PUT thẳng lên B2) chỉ dùng khi bucket đã có CORS rule s3_put.
 *
 * Bucket PRIVATE (không cần thẻ thanh toán): Worker tự phát file cho khách xem qua
 *   GET    /media/<key>     — đọc file từ bucket private (có Range cho video, có cache), KHÔNG cần đăng nhập
 *
 * Endpoint:
 *   GET    /health          — kiểm tra Worker đang chạy và đã cấu hình đủ biến
 *   POST   /presign         — { filename, contentType, size, folder } → { uploadUrl, publicUrl, key, headers }
 *   PUT    /upload?…        — tải qua Worker (mặc định, tối đa ~100 MB theo giới hạn Cloudflare)
 *   DELETE /file?key=…      — xoá file trên B2
 *   POST   /admin/invite    — { email } gửi email mời đặt mật khẩu (cần SUPABASE_SERVICE_ROLE_KEY)
 *
 * Mọi endpoint (trừ /health) yêu cầu header  Authorization: Bearer <access_token Supabase>
 * và email đăng nhập phải nằm trong bảng `admins`.
 */
import { AwsClient } from 'aws4fetch';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv', 'video/quicktime': 'mov'
};
const FOLDERS = ['banner', 'games', 'ads', 'misc', 'donate', 'library'];

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD')) return serveMedia(req, env, ctx, url);
    if (url.pathname.startsWith('/media/') && req.method === 'OPTIONS') return new Response(null, { status: 204, headers: MEDIA_CORS });

    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (path === '/health' && req.method === 'GET') {
        const missing = ['B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET', 'B2_ENDPOINT', 'B2_REGION', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']
          .filter(k => !env[k]);
        return json({ ok: missing.length === 0, missing, mediaBase: mediaBase(env, url), invite: !!env.SUPABASE_SERVICE_ROLE_KEY, maxUploadMb: maxMb(env) }, 200, cors);
      }

      const admin = await requireAdmin(req, env);

      if (path === '/presign' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { key, contentType } = buildKey(body, env);
        const target = objectUrl(env, key);
        target.searchParams.set('X-Amz-Expires', String(Number(env.PRESIGN_EXPIRES || 900)));
        const signed = await b2(env).sign(new Request(target, { method: 'PUT', headers: { 'Content-Type': contentType } }), {
          aws: { signQuery: true, allHeaders: false }
        });
        return json({
          uploadUrl: signed.url,
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          key,
          publicUrl: publicUrl(env, url, key),
          expiresIn: Number(env.PRESIGN_EXPIRES || 900),
          by: admin.email
        }, 200, cors);
      }

      if (path === '/upload' && (req.method === 'PUT' || req.method === 'POST')) {
        const contentType = (req.headers.get('Content-Type') || '').split(';')[0].trim();
        const size = Number(req.headers.get('Content-Length') || 0);
        const { key } = buildKey({ filename: url.searchParams.get('filename'), folder: url.searchParams.get('folder'), contentType, size }, env);
        if (!size) throw httpError(411, 'Thiếu dung lượng file (Content-Length)');
        // B2 cần biết trước dung lượng → dùng FixedLengthStream để đẩy thẳng, không giữ cả file trong bộ nhớ
        let body;
        if (typeof FixedLengthStream !== 'undefined' && req.body) {
          const { readable, writable } = new FixedLengthStream(size);
          req.body.pipeTo(writable).catch(() => {});
          body = readable;
        } else {
          body = await req.arrayBuffer();
        }
        // Ký 1 lần rồi gửi thẳng (KHÔNG dùng aws.fetch: nó tự gửi lại khi B2 báo 5xx,
        // nhưng luồng file đã đọc hết nên sẽ lỗi "ReadableStream is disturbed")
        const signed = await b2(env).sign(objectUrl(env, key).toString(), {
          method: 'PUT',
          body,
          headers: { 'Content-Type': contentType, 'Content-Length': String(size), 'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD' }
        });
        const res = await fetch(signed);
        if (!res.ok) throw await b2Error(res);
        return json({ key, publicUrl: publicUrl(env, url, key) }, 200, cors);
      }

      if (path === '/file' && req.method === 'DELETE') {
        const key = url.searchParams.get('key') || '';
        if (!validKey(key)) throw httpError(400, 'Key không hợp lệ');
        const res = await fetch(await b2(env).sign(objectUrl(env, key).toString(), { method: 'DELETE' }));
        if (!res.ok && res.status !== 404) throw httpError(502, 'Không xoá được file: ' + res.status);
        return json({ deleted: key }, 200, cors);
      }

      if (path === '/admin/invite' && req.method === 'POST') {
        if (!env.SUPABASE_SERVICE_ROLE_KEY) throw httpError(501, 'Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên Worker');
        const { email, redirectTo } = await req.json().catch(() => ({}));
        const em = String(email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) throw httpError(400, 'Email không hợp lệ');
        const listed = await isListedAdmin(env, req.headers.get('Authorization'), em);
        if (!listed) throw httpError(400, 'Hãy thêm email vào danh sách quản trị viên trước khi gửi lời mời');
        const res = await fetch(`${env.SUPABASE_URL}/auth/v1/invite`, {
          method: 'POST',
          headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: em, data: { invited_by: admin.email }, ...(safeRedirect(redirectTo, env) ? { redirect_to: safeRedirect(redirectTo, env) } : {}) })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = out.msg || out.message || out.error_description || 'Không gửi được lời mời';
          throw httpError(res.status === 422 ? 409 : 502, /already/i.test(msg) ? 'Email này đã có tài khoản. Người đó dùng “Quên mật khẩu” để đặt mật khẩu.' : msg);
        }
        return json({ invited: em }, 200, cors);
      }

      throw httpError(404, 'Không có endpoint này');
    } catch (err) {
      return json({ error: err.message || 'Lỗi không xác định' }, err.status || 500, cors);
    }
  }
};

/* ---------------- B2 (S3-compatible) ---------------- */
function b2(env) {
  return new AwsClient({ accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APP_KEY, service: 's3', region: env.B2_REGION });
}
function objectUrl(env, key) {
  const host = env.B2_ENDPOINT.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return new URL(`https://${host}/${env.B2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`);
}
// Link để hiện file trên web. Bucket private → mặc định đi qua Worker: https://<worker>/media/<key>
// (Nếu sau này có tên miền riêng trỏ vào Worker, đặt PUBLIC_BASE_URL = https://media.ten-mien.com/media)
function mediaBase(env, url) {
  return (env.PUBLIC_BASE_URL || `${url.origin}/media`).replace(/\/+$/, '');
}
function publicUrl(env, url, key) {
  return `${mediaBase(env, url)}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
const validKey = k => /^(banner|games|ads|misc|donate|library)\/(images|videos)\/\d{4}\/\d{2}\/[a-z0-9-]{1,80}\.[a-z0-9]{2,4}$/.test(k);

/* ---------------- Phát file từ bucket private ---------------- */
const MEDIA_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Max-Age': '86400' };
async function serveMedia(req, env, ctx, url) {
  let key;
  try { key = decodeURIComponent(url.pathname.slice('/media/'.length)); } catch { key = ''; }
  if (!validKey(key)) return new Response('Không tìm thấy file', { status: 404, headers: MEDIA_CORS });
  const ttl = Number(env.MEDIA_CACHE_SECONDS || 31536000);
  const range = req.headers.get('Range');
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/media/${key}`, { method: 'GET' });

  // 1) Cache của Cloudflare (chỉ có tác dụng khi Worker chạy trên tên miền riêng, workers.dev bỏ qua)
  if (req.method === 'GET' && !range) {
    try { const hit = await cache.match(cacheKey); if (hit) return hit; } catch {}
  }

  // 2) Đọc từ B2 bằng request có chữ ký
  const signed = await b2(env).sign(objectUrl(env, key).toString(), { method: req.method, headers: range ? { Range: range } : {} });
  const res = await fetch(signed, { cf: { cacheEverything: true, cacheTtl: ttl } });
  if (res.status === 404) return new Response('Không tìm thấy file', { status: 404, headers: MEDIA_CORS });
  if (!res.ok && res.status !== 206) {
    const t = await res.text().catch(() => '');
    const capped = /cap|exceeded|limit/i.test(t);
    return new Response(capped ? 'B2 đã hết hạn mức tải xuống miễn phí trong ngày' : 'Không đọc được file từ B2', { status: capped ? 503 : 502, headers: { ...MEDIA_CORS, 'Retry-After': '3600', 'Cache-Control': 'no-store' } });
  }

  const h = new Headers(MEDIA_CORS);
  for (const k of ['content-type', 'content-length', 'content-range', 'etag', 'last-modified']) { const v = res.headers.get(k); if (v) h.set(k, v); }
  h.set('Accept-Ranges', 'bytes');
  h.set('Cache-Control', `public, max-age=${ttl}, immutable`);   // tên file có mã ngẫu nhiên → cache lâu an toàn
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox");
  h.set('Content-Disposition', 'inline');
  const out = new Response(req.method === 'HEAD' ? null : res.body, { status: res.status, headers: h });
  if (req.method === 'GET' && !range && res.status === 200 && ctx?.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, out.clone()).catch(() => {}));
  }
  return out;
}
const maxMb = env => Number(env.MAX_UPLOAD_MB || 95);

function buildKey({ filename, contentType, size, folder }, env) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(type)) throw httpError(415, 'Chỉ nhận ảnh (JPG, PNG, WebP, GIF, AVIF, SVG) hoặc video (MP4, WebM, MOV)');
  const limit = maxMb(env) * 1024 * 1024;
  if (Number(size) > limit) throw httpError(413, `File lớn hơn ${maxMb(env)} MB`);
  const dir = FOLDERS.includes(folder) ? folder : 'misc';
  const kind = type.startsWith('video/') ? 'videos' : 'images';
  const base = String(filename || 'file').replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const rand = crypto.getRandomValues(new Uint8Array(4)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  return { key: `${dir}/${kind}/${stamp}/${base}-${rand}.${EXT[type]}`, contentType: type };
}

/* ---------------- Xác thực quản trị viên qua Supabase ---------------- */
async function requireAdmin(req, env) {
  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+/.test(auth)) throw httpError(401, 'Chưa đăng nhập');
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth } });
  if (!userRes.ok) throw httpError(401, 'Phiên đăng nhập hết hạn, hãy đăng nhập lại');
  const user = await userRes.json();
  const rpc = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!rpc.ok || (await rpc.json()) !== true) throw httpError(403, 'Tài khoản này không phải quản trị viên');
  return { email: String(user.email || '').toLowerCase(), id: user.id };
}
async function isListedAdmin(env, auth, email) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/admins?select=email&email=eq.${encodeURIComponent(email)}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth }
  });
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

/* ---------------- Tiện ích ---------------- */
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
}
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const list = allowedOrigins(env);
  const ok = list.includes('*') || list.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (list.includes('*') ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
function safeRedirect(u, env) {
  try {
    const x = new URL(u);
    return allowedOrigins(env).some(o => o === '*' || o === x.origin) ? x.toString() : '';
  } catch { return ''; }
}
function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

// Đọc lỗi XML của B2 và đổi thành thông báo dễ hiểu
async function b2Error(res) {
  const t = await res.text().catch(() => '');
  const code = (t.match(/<Code>([^<]+)<\/Code>/) || [])[1] || '';
  const msg = (t.match(/<Message>([^<]+)<\/Message>/) || [])[1] || t.slice(0, 160);
  const hint = {
    InvalidAccessKeyId: 'B2_KEY_ID sai hoặc key đã bị xoá.',
    SignatureDoesNotMatch: 'B2_APP_KEY sai, hoặc B2_REGION không khớp với B2_ENDPOINT.',
    AccessDenied: /cap|exceeded/i.test(msg) ? 'Đã hết hạn mức miễn phí trong ngày của B2.' : 'Application Key không có quyền ghi vào bucket này (cần Read and Write, đúng bucket).',
    NoSuchBucket: 'B2_BUCKET sai tên bucket.',
    InvalidRequest: 'Endpoint hoặc region không đúng với bucket.',
    ServiceUnavailable: 'B2 đang bận, hãy thử lại sau ít phút.',
    SlowDown: 'B2 đang bận, hãy thử lại sau ít phút.',
    InternalError: 'B2 gặp lỗi tạm thời, hãy thử lại.'
  }[code] || '';
  const retry = res.status >= 500 || res.status === 429 || code === 'SlowDown' || code === 'ServiceUnavailable';
  const e = httpError(retry ? 503 : 502, `B2 báo lỗi ${res.status}${code ? ' ' + code : ''}: ${hint || msg}`);
  e.retry = retry;
  return e;
}
