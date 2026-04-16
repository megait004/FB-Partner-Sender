const sleep = ms => new Promise(r => setTimeout(r, ms));

// ===== API: Cancel Request =====

const apiCancelRequest = ({ businessId, userId, requestId, fbDtsg, lsdToken, mutationIndex }) => {
  const body = new URLSearchParams({
    av: userId,
    __aaid: '0',
    __bid: businessId,
    __user: userId,
    __a: '1',
    __req: String((mutationIndex || 1) + 100),
    __ccg: 'EXCELLENT',
    fb_dtsg: fbDtsg,
    jazoest: '25577',
    lsd: lsdToken,
    __spin_b: 'trunk',
    __jssesw: '1',
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: 'BusinessCometBizSuiteDeleteRequestMutation',
    server_timestamps: 'true',
    variables: JSON.stringify({ business_id: businessId, request_id: requestId }),
    doc_id: '9916705241752890',
  });

  return fetch('https://business.facebook.com/api/graphql/?_callFlowletID=4538&_triggerFlowletID=4532&qpl_active_e2e_trace_ids=', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/x-www-form-urlencoded',
      'x-fb-friendly-name': 'BusinessCometBizSuiteDeleteRequestMutation',
      'x-fb-lsd': lsdToken,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    },
    referrer: `https://business.facebook.com/latest/settings/partners?business_id=${businessId}`,
    body: body.toString(),
    mode: 'cors',
    credentials: 'include',
  });
};

// ===== API: Send Partner Request =====

const apiSendPartner = async ({ email, partnerId, pageIds, userId, businessId, fbDtsg, lsdToken, mutationIndex }) => {
  const variables = {
    input: {
      actor_id: userId,
      client_mutation_id: String(mutationIndex || 1),
      contact_email: email,
      contact_name: '',
      has_requested_credit_line: false,
      receiving_business_id: partnerId,
      receiving_business_role: 'BRAND',
      requested_asset_permissions: [{ key: 'PAGE', value: pageIds }],
      requested_asset_types: ['PAGE'],
      requesting_business_id: businessId,
      requesting_business_role: 'BRAND',
    },
    requesting_business_id: businessId,
  };

  const body = new URLSearchParams({
    av: userId,
    __aaid: '0',
    __bid: businessId,
    __user: userId,
    __a: '1',
    __req: String(mutationIndex || 1),
    __ccg: 'EXCELLENT',
    fb_dtsg: fbDtsg,
    jazoest: '25429',
    lsd: lsdToken,
    __spin_b: 'trunk',
    __jssesw: '1',
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: 'BusinessCometRequestAssetShareMutation',
    server_timestamps: 'true',
    variables: JSON.stringify(variables),
    doc_id: '9802555459836741',
  });

  const resp = await fetch('https://business.facebook.com/api/graphql/?_callFlowletID=24604&_triggerFlowletID=24601&qpl_active_e2e_trace_ids=', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': 'vi-VN,vi;q=0.9',
      'content-type': 'application/x-www-form-urlencoded',
      'x-fb-friendly-name': 'BusinessCometRequestAssetShareMutation',
      'x-fb-lsd': lsdToken,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    },
    referrer: `https://business.facebook.com/latest/settings/partners?business_id=${businessId}`,
    body: body.toString(),
    mode: 'cors',
    credentials: 'include',
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const text = await resp.text();
  const cleaned = text.startsWith('for (;;);') ? text.slice(9) : text;

  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { throw new Error(`Response không hợp lệ: ${text.slice(0, 120)}`); }

  if (parsed.__ar === 1 && parsed.error) throw new Error(`[${parsed.error}] ${parsed.errorSummary || ''} — ${parsed.errorDescription || ''}`);
  if (parsed.errors?.length) {
    const e = parsed.errors[0];
    throw new Error(`${e.message || 'Lỗi từ API'} | type: ${e.type || ''} | path: ${(e.path || []).join('.')}`);
  }
  if (!parsed.data) throw new Error(`data=null — ${JSON.stringify(parsed).slice(0, 150)}`);

  const shareData = parsed.data?.xfb_request_asset_share;
  const requestId = shareData?.id ?? shareData?.request?.id ?? null;

  if (requestId) {
    await apiCancelRequest({ businessId, userId, requestId, fbDtsg, lsdToken, mutationIndex });
    return { canceled: true };
  }

  return { canceled: false };
};

// ===== Overlay Panel =====

let overlayEl = null;
let stopFlag = false;

const PANEL_STYLES = `
  #fbps-overlay {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.65) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  }
  #fbps-panel {
    background: #0e1117;
    border: 1px solid #30363d;
    border-radius: 12px;
    width: 500px;
    max-height: 88vh;
    overflow-y: auto;
    color: #e6edf3;
    font-size: 13px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
  #fbps-panel * { box-sizing: border-box; }
  #fbps-header {
    background: linear-gradient(135deg, #1877f2, #0d5ed9);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 12px 12px 0 0;
    flex-shrink: 0;
  }
  #fbps-header-left { display: flex; align-items: center; gap: 10px; }
  #fbps-header-icon {
    width: 28px; height: 28px;
    background: white;
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  }
  #fbps-header-title { font-size: 15px; font-weight: 700; color: white; }
  #fbps-header-sub { font-size: 11px; color: rgba(255,255,255,0.75); }
  #fbps-status-badge {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 20px;
    font-weight: 600;
    background: rgba(255,255,255,0.2);
    color: white;
  }
  #fbps-close-btn {
    background: rgba(255,255,255,0.15);
    border: none;
    color: white;
    width: 28px; height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  #fbps-close-btn:hover { background: rgba(255,255,255,0.3); }
  #fbps-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
  .fbps-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .fbps-stat-box {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 8px;
    text-align: center;
  }
  .fbps-stat-num { font-size: 22px; font-weight: 700; }
  .fbps-stat-label { font-size: 10px; color: #8b949e; margin-top: 2px; }
  .fbps-stat-total .fbps-stat-num { color: #58a6ff; }
  .fbps-stat-ok    .fbps-stat-num { color: #3fb950; }
  .fbps-stat-fail  .fbps-stat-num { color: #f85149; }
  .fbps-prog-bar-wrap {
    background: #21262d;
    border-radius: 4px;
    height: 7px;
    overflow: hidden;
  }
  #fbps-bar {
    height: 100%;
    background: linear-gradient(90deg, #1877f2, #58a6ff);
    border-radius: 4px;
    transition: width 0.35s ease;
    width: 0%;
  }
  .fbps-prog-info {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #8b949e;
    margin-top: 5px;
  }
  #fbps-log {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 8px 10px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 11px;
    line-height: 1.7;
    font-family: 'Consolas', monospace;
  }
  #fbps-log:empty::before { content: 'Chờ bắt đầu...'; color: #3d444d; }
  .fbps-log-success { color: #3fb950; }
  .fbps-log-error   { color: #f85149; }
  .fbps-log-info    { color: #58a6ff; }
  .fbps-log-warn    { color: #e3b341; }
  .fbps-divider { border: none; border-top: 1px solid #21262d; margin: 0; }
  #fbps-actions { display: flex; gap: 8px; }
  .fbps-btn {
    flex: 1;
    padding: 9px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  #fbps-stop-btn {
    background: #da3633;
    color: white;
  }
  #fbps-stop-btn:hover:not(:disabled) { background: #b91c1c; }
  #fbps-stop-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  #fbps-hint {
    font-size: 11px;
    color: #484f58;
    text-align: center;
    padding-bottom: 4px;
  }
`;

const injectStyles = () => {
  if (document.getElementById('fbps-styles')) return;
  const style = document.createElement('style');
  style.id = 'fbps-styles';
  style.textContent = PANEL_STYLES;
  document.head.appendChild(style);
};

const removeOverlay = () => {
  overlayEl?.remove();
  overlayEl = null;
};

const panelLog = (msg, type = 'info') => {
  const box = document.getElementById('fbps-log');
  if (!box) return;
  const line = document.createElement('div');
  line.className = `fbps-log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
};

const updateStats = (stats) => {
  const el = id => document.getElementById(id);
  if (el('fbps-total')) el('fbps-total').textContent = stats.total;
  if (el('fbps-ok'))    el('fbps-ok').textContent    = stats.ok;
  if (el('fbps-fail'))  el('fbps-fail').textContent  = stats.fail;
};

const updateProgress = (current, total) => {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  const bar      = document.getElementById('fbps-bar');
  const pctText  = document.getElementById('fbps-pct');
  const progText = document.getElementById('fbps-prog-text');
  if (bar)      bar.style.width = pct + '%';
  if (pctText)  pctText.textContent = pct + '%';
  if (progText) progText.textContent = `${current} / ${total} email`;
};

const setStatus = (text, done = false) => {
  const badge = document.getElementById('fbps-status-badge');
  if (!badge) return;
  badge.textContent = text;
  badge.style.background = done ? 'rgba(63,185,80,0.25)' : 'rgba(255,255,255,0.2)';
  badge.style.color = done ? '#3fb950' : 'white';
};

const createOverlay = (emailCount) => {
  injectStyles();
  removeOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'fbps-overlay';

  overlay.innerHTML = `
    <div id="fbps-panel">
      <div id="fbps-header">
        <div id="fbps-header-left">
          <div id="fbps-header-icon">🤝</div>
          <div>
            <div id="fbps-header-title">FB Partner Sender</div>
            <div id="fbps-header-sub">Gửi ${emailCount} email</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="fbps-status-badge">⏳ Đang gửi...</span>
          <button id="fbps-close-btn" title="Đóng panel">✕</button>
        </div>
      </div>

      <div id="fbps-body">
        <div class="fbps-stats">
          <div class="fbps-stat-box fbps-stat-total">
            <div class="fbps-stat-num" id="fbps-total">0</div>
            <div class="fbps-stat-label">Tổng</div>
          </div>
          <div class="fbps-stat-box fbps-stat-ok">
            <div class="fbps-stat-num" id="fbps-ok">0</div>
            <div class="fbps-stat-label">Thành công</div>
          </div>
          <div class="fbps-stat-box fbps-stat-fail">
            <div class="fbps-stat-num" id="fbps-fail">0</div>
            <div class="fbps-stat-label">Thất bại</div>
          </div>
        </div>

        <div>
          <div class="fbps-prog-bar-wrap">
            <div id="fbps-bar"></div>
          </div>
          <div class="fbps-prog-info">
            <span id="fbps-prog-text">Đang khởi động...</span>
            <span id="fbps-pct">0%</span>
          </div>
        </div>

        <hr class="fbps-divider" />

        <div id="fbps-log"></div>

        <div id="fbps-actions">
          <button class="fbps-btn" id="fbps-stop-btn">⏹ Dừng gửi</button>
        </div>


      </div>
    </div>
  `;

  // Block outside clicks from closing — only explicit buttons close
  overlay.addEventListener('click', e => e.stopPropagation());

  document.body.appendChild(overlay);
  overlayEl = overlay;

  document.getElementById('fbps-close-btn').addEventListener('click', () => {
    if (stopFlag === false) {
      stopFlag = true;
    }
    removeOverlay();
  });

  document.getElementById('fbps-stop-btn').addEventListener('click', () => {
    stopFlag = true;
    const btn = document.getElementById('fbps-stop-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏹ Đang dừng...'; }
  });
};

const runSending = async (config) => {
  const { emails, userId, businessId, fbDtsg, lsdToken, pageIds, partnerIds, delayMs } = config;

  stopFlag = false;
  const stats = { total: emails.length, ok: 0, fail: 0 };
  updateStats(stats);
  updateProgress(0, emails.length);

  panelLog(`Bắt đầu gửi ${emails.length} email (${partnerIds.length} business ID xoay vòng)...`, 'info');

  for (let i = 0; i < emails.length; i++) {
    if (stopFlag) {
      panelLog('⏹ Đã dừng theo yêu cầu.', 'warn');
      break;
    }

    const email     = emails[i];
    const partnerId = partnerIds[i % partnerIds.length];
    panelLog(`→ [${i + 1}/${emails.length}] ${email} → BM: ${partnerId}`, 'info');

    try {
      const result = await apiSendPartner({ email, partnerId, pageIds, userId, businessId, fbDtsg, lsdToken, mutationIndex: i + 1 });
      stats.ok++;
      panelLog(`✓ Thành công: ${email}${result.canceled ? ' (đã hủy request)' : ''}`, 'success');
    } catch (err) {
      stats.fail++;
      panelLog(`✗ Thất bại: ${email} — ${err.message}`, 'error');
    }

    updateStats(stats);
    updateProgress(i + 1, emails.length);

    if (i < emails.length - 1 && !stopFlag) await sleep(delayMs);
  }

  const allDone = !stopFlag;
  setStatus(allDone ? '✓ Hoàn tất' : '⏹ Đã dừng', true);
  panelLog(
    allDone
      ? `Hoàn tất! ✓ ${stats.ok} thành công, ✗ ${stats.fail} thất bại.`
      : `Đã dừng. ✓ ${stats.ok} thành công, ✗ ${stats.fail} thất bại.`,
    stats.fail === 0 ? 'success' : 'warn',
  );

  const stopBtn = document.getElementById('fbps-stop-btn');
  if (stopBtn) { stopBtn.disabled = true; stopBtn.textContent = '✓ Đã xong'; }
};

const startSendingPanel = (config) => {
  createOverlay(config.emails.length);
  runSending(config);
};

// ===== Auto Token Extractor =====

const extractTokensFromPage = () => {
  const html = document.documentElement.innerHTML;

  const matchFirst = (pattern) => {
    const m = html.match(pattern);
    return m ? m[1] : null;
  };

  const fbDtsg =
    matchFirst(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/) ||
    matchFirst(/name="fb_dtsg" value="([^"]+)"/) ||
    matchFirst(/"fb_dtsg":{"value":"([^"]+)"/) ||
    document.querySelector('input[name="fb_dtsg"]')?.value ||
    null;

  const lsdToken =
    matchFirst(/"LSD",\[\],\{"token":"([^"]+)"/) ||
    matchFirst(/"lsd":"([^"]+)"/) ||
    null;

  const userId =
    matchFirst(/"USER_ID":"(\d+)"/) ||
    matchFirst(/"actorID":"(\d+)"/) ||
    matchFirst(/"userID":"(\d+)"/) ||
    null;

  return { fbDtsg, lsdToken, userId };
};

// ===== Message Handler =====

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_TOKENS') {
    try {
      const tokens = extractTokensFromPage();
      sendResponse({ ok: true, ...tokens });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  }

  if (msg.type === 'SEND_PARTNER_REQUEST') {
    const p = msg.payload;
    apiSendPartner(p)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(err  => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'START_SENDING') {
    startSendingPanel(msg.payload);
    sendResponse({ ok: true });
    return true;
  }
});
