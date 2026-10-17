/**
 * Vinh Làm Game — Cloudflare Worker: tải hình / video lên Backblaze B2
 *
 * Luồng chính (khuyên dùng, không giới hạn dung lượng của Worker):
 *   1. admin.html gọi POST /presign  → Worker kiểm tra quản trị viên, trả về link PUT có chữ ký (hết hạn sau vài phút)
 *   2. Trình duyệt PUT file thẳng lên B2 qua link đó (có thanh tiến trình)
 *   3. Dán publicUrl vào ô ảnh / video
 *
 * Endpoint:
 *   GET    /health          — kiểm tra Worker đang chạy và đã cấu hình đủ biến
 *   POST   /presign         — { filename, contentType, size, folder } → { uploadUrl, publicUrl, key, headers }
 *   PUT    /upload?…        — tải qua Worker (dự phòng, tối đa ~100 MB theo giới hạn Cloudflare)
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
const FOLDERS = ['banner', 'games', 'ads', 'misc', 'donate'];

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      const url = new URL(req.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (path === '/health' && req.method === 'GET') {
        const missing = ['B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET', 'B2_ENDPOINT', 'B2_REGION', 'PUBLIC_BASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']
          .filter(k => !env[k]);
        return json({ ok: missing.length === 0, missing, invite: !!env.SUPABASE_SERVICE_ROLE_KEY, maxUploadMb: maxMb(env) }, 200, cors);
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
          publicUrl: publicUrl(env, key),
          expiresIn: Number(env.PRESIGN_EXPIRES || 900),
          by: admin.email
        }, 200, cors);
      }

      if (path === '/upload' && (req.method === 'PUT' || req.method === 'POST')) {
        const contentType = (req.headers.get('Content-Type') || '').split(';')[0].trim();
        const size = Number(req.headers.get('Content-Length') || 0);
        const { key } = buildKey({ filename: url.searchParams.get('filename'), folder: url.searchParams.get('folder'), contentType, size }, env);
        const res = await b2(env).fetch(objectUrl(env, key), {
          method: 'PUT',
          body: req.body,
          headers: { 'Content-Type': contentType, 'Content-Length': String(size), 'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD' }
        });
        if (!res.ok) throw httpError(502, 'B2 từ chối file: ' + (await res.text()).slice(0, 300));
        return json({ key, publicUrl: publicUrl(env, key) }, 200, cors);
      }

      if (path === '/file' && req.method === 'DELETE') {
        const key = url.searchParams.get('key') || '';
        if (!/^[a-z0-9][a-z0-9/_.-]{3,300}$/i.test(key) || key.includes('..')) throw httpError(400, 'Key không hợp lệ');
        const res = await b2(env).fetch(objectUrl(env, key), { method: 'DELETE' });
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
function publicUrl(env, key) {
  return `${env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
const maxMb = env => Number(env.MAX_UPLOAD_MB || 200);

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
