/*! Vinh Làm Game — đoạn code gắn vào từng game (vlg.js)
 *
 * Cách gắn: thêm 1 dòng vào cuối <body> của game, đổi data-game thành slug của game trên vinhlamgame:
 *   <script src="https://vinhlamgame.vercel.app/vlg.js" data-game="dapa-dap-pha" defer></script>
 *
 * Tuỳ chọn trên thẻ script:
 *   data-pos="tl|tr|bl|br"   vị trí nút "← Vinh Làm Game" (mặc định tl = góc trên trái), tránh đè nút của game
 *   data-back="off"          ẩn nút quay về
 *   data-install="off"       không hiện hướng dẫn thêm ra màn hình chính
 *
 * Gọi từ code game:
 *   VLG.more()      hiện thẻ "Chơi game khác / Chia sẻ / Ủng hộ" — gọi ở màn hình thắng hoặc thua
 *   VLG.install()   mở lại hướng dẫn thêm ra màn hình chính
 *
 * Khi game chạy trong khung của vinhlamgame (chế độ rạp chiếu), đoạn code này không hiện gì cả.
 */
(function () {
  'use strict';
  if (window.VLG) return;
  var me = document.currentScript || {};
  var ds = me.dataset || {};
  var SITE = ds.site || (me.src ? new URL(me.src).origin : 'https://vinhlamgame.vercel.app');
  var SLUG = ds.game || '';
  var GAME_URL = SITE + '/#/game/' + encodeURIComponent(SLUG);
  var inFrame; try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
  var mq = function (q) { try { return matchMedia(q).matches; } catch (e) { return false; } };
  var standalone = mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)') || navigator.standalone === true;
  var mobile = mq('(pointer: coarse)') && !mq('(hover: hover)');
  var UA = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  var inApp = (/FBAN|FBAV|FB_IAB|Instagram|Zalo|Line\/|TikTok|musical_ly/i.exec(UA) || [''])[0];
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; });

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // To\u00e0n b\u1ed9 giao di\u1ec7n n\u1eb1m trong Shadow DOM \u0111\u1ec3 kh\u00f4ng \u1ea3nh h\u01b0\u1edfng CSS c\u1ee7a game
  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000';
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var CSS = '' +
    ':host{all:initial}*{box-sizing:border-box;font-family:"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.back{pointer-events:auto;position:fixed;display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.92);color:#6B1A2D;font-size:12px;font-weight:700;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.25);opacity:.9;transition:opacity .4s}' +
    '.back.dim{opacity:.35}.back:hover,.back:focus{opacity:1}' +
    '.tl{top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px))}.tr{top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px))}' +
    '.bl{bottom:calc(10px + env(safe-area-inset-bottom,0px));left:calc(10px + env(safe-area-inset-left,0px))}.br{bottom:calc(10px + env(safe-area-inset-bottom,0px));right:calc(10px + env(safe-area-inset-right,0px))}' +
    '.ov{pointer-events:auto;position:fixed;inset:0;background:rgba(20,10,14,.6);display:flex;align-items:flex-end;justify-content:center}' +
    '.ov.mid{align-items:center;padding:16px}' +
    '.card{position:relative;background:#fff;color:#22151B;width:100%;max-width:480px;max-height:92vh;overflow:auto;border-radius:14px 14px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom,0px));display:grid;gap:12px}' +
    '.mid .card{border-radius:12px}' +
    '.k{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7C6A71;margin:0}' +
    'h2{margin:0;font-size:20px;line-height:1.25;font-weight:800;padding-right:30px}' +
    '.why{list-style:none;margin:0;padding:12px 14px;background:#F5EBEE;border-radius:6px;display:grid;gap:6px;font-size:14px;color:#6B1A2D}.why li:before{content:"\\2713  ";font-weight:700}' +
    'ol{margin:0;padding-left:20px;display:grid;gap:8px;font-size:15px;line-height:1.5}' +
    '.warn{margin:0;font-size:14px;color:#8A3B12;background:#FFF3E8;padding:10px 12px;border-radius:6px}' +
    '.btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border-radius:6px;border:0;background:#6B1A2D;color:#fff;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer}' +
    '.btn.line{background:#fff;color:#22151B;border:1px solid #D9C9CE}' +
    '.x{position:absolute;top:8px;right:10px;width:40px;height:40px;border:0;background:none;font-size:24px;color:#7C6A71;cursor:pointer}' +
    '.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#6B1A2D;font-size:14px}' +
    'svg{vertical-align:-3px}';
  var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
  function mount() { if (!host.isConnected) document.body.appendChild(host); }

  var LOGO = '<svg width="16" height="16" viewBox="0 0 26 26" aria-hidden="true"><g fill="#6B1A2D"><rect x="0" y="0" width="8" height="8"/><rect x="18" y="0" width="8" height="8"/><rect x="0" y="9" width="8" height="8"/><rect x="18" y="9" width="8" height="8"/><rect x="9" y="18" width="8" height="8"/></g></svg>';
  var SHARE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F5A85" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M16 6l-4-4-4 4M12 2v13"/></svg>';

  function overlay(html, mid) {
    close();
    var ov = document.createElement('div'); ov.className = 'ov' + (mid ? ' mid' : ''); ov.id = 'ov';
    ov.innerHTML = '<div class="card" role="dialog" aria-modal="true"><button class="x" type="button" aria-label="\u0110\u00f3ng" data-x>\u00d7</button>' + html + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.hasAttribute('data-x')) close(); });
    root.appendChild(ov); mount(); return ov;
  }
  function close() { var o = root.querySelector('#ov'); if (o) o.remove(); }

  // 1. N\u00fat quay v\u1ec1 Vinh L\u00e0m Game
  function addBack() {
    if (ds.back === 'off') return;
    var a = document.createElement('a');
    a.className = 'back ' + (/^(tl|tr|bl|br)$/.test(ds.pos || '') ? ds.pos : 'tl');
    a.href = GAME_URL; a.innerHTML = '\u2190 ' + LOGO + ' Vinh L\u00e0m Game';
    a.setAttribute('aria-label', 'V\u1ec1 trang Vinh L\u00e0m Game');
    root.appendChild(a); mount();
    setTimeout(function () { a.classList.add('dim'); }, 4000);
  }

  // 2. H\u01b0\u1edbng d\u1eabn th\u00eam game ra m\u00e0n h\u00ecnh ch\u00ednh
  function steps() {
    if (inApp) {
      var app = /Zalo/i.test(inApp) ? 'Zalo' : /Instagram/i.test(inApp) ? 'Instagram' : /TikTok|musical/i.test(inApp) ? 'TikTok' : 'Facebook';
      return '<p class="warn">B\u1ea1n \u0111ang m\u1edf trong <b>' + app + '</b>. \u1ee8ng d\u1ee5ng n\u00e0y kh\u00f4ng cho th\u00eam game ra m\u00e0n h\u00ecnh ch\u00ednh.</p>' +
        '<ol><li>B\u1ea5m n\u00fat <b>\u22ef</b> \u1edf g\u00f3c tr\u00ean.</li><li>Ch\u1ecdn <b>M\u1edf b\u1eb1ng tr\u00ecnh duy\u1ec7t</b> (' + (isIOS ? 'Safari' : 'Chrome') + ').</li><li>L\u00e0m theo h\u01b0\u1edbng d\u1eabn hi\u1ec7n ra.</li></ol>';
    }
    if (isIOS && /CriOS|FxiOS|EdgiOS/.test(UA)) return '<ol><li>B\u1ea5m n\u00fat chia s\u1ebb ' + SHARE + ' \u1edf g\u00f3c tr\u00ean b\u00ean ph\u1ea3i thanh \u0111\u1ecba ch\u1ec9.</li><li>Ch\u1ecdn <b>Th\u00eam v\u00e0o MH ch\u00ednh</b> (Add to Home Screen).</li><li>M\u1edf game b\u1eb1ng bi\u1ec3u t\u01b0\u1ee3ng tr\u00ean m\u00e0n h\u00ecnh ch\u00ednh.</li></ol>';
    if (isIOS) return '<ol><li>B\u1ea5m n\u00fat <b>Chia s\u1ebb</b> ' + SHARE + ' \u1edf thanh d\u01b0\u1edbi c\u00f9ng c\u1ee7a Safari.</li><li>K\u00e9o xu\u1ed1ng, ch\u1ecdn <b>Th\u00eam v\u00e0o MH ch\u00ednh</b> (Add to Home Screen) \u2192 <b>Th\u00eam</b>.</li><li>M\u1edf game b\u1eb1ng bi\u1ec3u t\u01b0\u1ee3ng tr\u00ean m\u00e0n h\u00ecnh ch\u00ednh.</li></ol>';
    return '<ol><li>B\u1ea5m n\u00fat <b>\u22ee</b> \u1edf g\u00f3c tr\u00ean b\u00ean ph\u1ea3i Chrome.</li><li>Ch\u1ecdn <b>Th\u00eam v\u00e0o m\u00e0n h\u00ecnh ch\u00ednh</b> ho\u1eb7c <b>C\u00e0i \u0111\u1eb7t \u1ee9ng d\u1ee5ng</b>.</li><li>M\u1edf game b\u1eb1ng bi\u1ec3u t\u01b0\u1ee3ng tr\u00ean m\u00e0n h\u00ecnh ch\u00ednh.</li></ol>';
  }
  function install() {
    var ov = overlay('<p class="k">M\u1eb9o ch\u01a1i tr\u00ean \u0111i\u1ec7n tho\u1ea1i</p><h2>Th\u00eam game ra m\u00e0n h\u00ecnh ch\u00ednh \u0111\u1ec3 ch\u01a1i tr\u1ecdn m\u00e0n h\u00ecnh</h2>' +
      '<ul class="why"><li>M\u1edf to\u00e0n m\u00e0n h\u00ecnh, kh\u00f4ng c\u00f2n thanh \u0111\u1ecba ch\u1ec9 che game</li><li>M\u1edf nhanh nh\u01b0 app, kh\u00f4ng ph\u1ea3i t\u1ea3i t\u1eeb App Store hay CH Play</li><li>Kh\u00f4ng chi\u1ebfm dung l\u01b0\u1ee3ng m\u00e1y nh\u01b0 c\u00e0i app</li></ul>' +
      (deferredPrompt && !inApp ? '<button class="btn" type="button" data-inst>Th\u00eam ra m\u00e0n h\u00ecnh ch\u00ednh</button>' : steps()) +
      '<button class="btn line" type="button" data-later>\u0110\u1ec3 sau, ch\u01a1i lu\u00f4n</button>');
    var b = ov.querySelector('[data-inst]');
    if (b) b.addEventListener('click', function () { deferredPrompt.prompt(); deferredPrompt.userChoice.finally(function () { deferredPrompt = null; close(); }); });
    ov.querySelector('[data-later]').addEventListener('click', function () { store('vlg_install_snooze', String(Date.now())); close(); });
  }
  function maybeInstall() {
    if (ds.install === 'off' || !mobile || standalone) return;
    var last = Number(store('vlg_install_snooze')) || 0;
    if (Date.now() - last < 3 * 864e5) return;           // nh\u1eafc l\u1ea1i sau 3 ng\u00e0y
    setTimeout(install, 2500);
  }

  // 3. Th\u1ebb "Ch\u01a1i game kh\u00e1c" cho m\u00e0n h\u00ecnh th\u1eafng / thua
  function share() {
    var url = location.href.split('#')[0];
    if (navigator.share) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { alert('\u0110\u00e3 ch\u00e9p link game'); });
  }
  function more() {
    var ov = overlay('<p class="brand">' + LOGO + ' Vinh L\u00e0m Game</p><h2>C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 ch\u01a1i!</h2>' +
      '<p style="margin:0;font-size:15px;line-height:1.5;color:#4A3A41">Studio c\u00f2n nhi\u1ec1u game nh\u1ecf kh\u00e1c, ch\u01a1i ngay tr\u00ean tr\u00ecnh duy\u1ec7t.</p>' +
      '<a class="btn" href="' + SITE + '/#/" target="_top">Ch\u01a1i game kh\u00e1c</a>' +
      '<div class="row"><button class="btn line" type="button" data-share>Chia s\u1ebb game</button><a class="btn line" href="' + SITE + '/#/ung-ho" target="_top">\u1ee6ng h\u1ed9 studio</a></div>', true);
    ov.querySelector('[data-share]').addEventListener('click', share);
  }

  window.VLG = { more: more, install: install, close: close, site: SITE, gameUrl: GAME_URL };
  if (inFrame) return;                                    // trong khung c\u1ee7a vinhlamgame: kh\u00f4ng hi\u1ec7n g\u00ec
  var start = function () { addBack(); maybeInstall(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
