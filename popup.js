const $ = (id) => document.getElementById(id);

let running = false;
let stats = { total: 0, ok: 0, fail: 0 };

const SAVE_FIELDS = ['userId', 'businessId', 'fbDtsg', 'lsdToken', 'pageIds', 'partnerIds', 'delayMs', 'emailList'];

const DEFAULTS = {
  businessId: '1230772795911914',
  pageIds: '556750461849806',
};

const saveForm = () => {
  SAVE_FIELDS.forEach((id) => {
    localStorage.setItem(id, $(id).value);
  });
};

const loadForm = () => {
  SAVE_FIELDS.forEach((id) => {
    const val = localStorage.getItem(id);
    if (val !== null) $(id).value = val;
    else if (DEFAULTS[id]) $(id).value = DEFAULTS[id];
  });
};

document.addEventListener('DOMContentLoaded', () => {
  loadForm();
  SAVE_FIELDS.forEach((id) => {
    $(id).addEventListener('input', saveForm);
  });
});

const log = (msg, type = 'info') => {
  const box = $('logBox');
  const line = document.createElement('div');
  line.className = `log-${type}`;
  const now = new Date().toLocaleTimeString('vi-VN');
  line.textContent = `[${now}] ${msg}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
};

const updateStats = () => {
  $('statTotal').textContent = stats.total;
  $('statOk').textContent    = stats.ok;
  $('statFail').textContent  = stats.fail;
};

const updateProgress = (current, total) => {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  $('progressBar').style.width = pct + '%';
  $('progressPct').textContent = pct + '%';
  $('progressText').textContent = `${current} / ${total} email`;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getFacebookTabId = () =>
  new Promise((resolve, reject) => {
    chrome.tabs.query({ url: 'https://business.facebook.com/*' }, (tabs) => {
      if (tabs.length === 0) reject(new Error('Chưa mở tab business.facebook.com. Vui lòng mở trang trước.'));
      else resolve(tabs[0].id);
    });
  });

const injectContentScript = (tabId) =>
  chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });

const sendMessage = (tabId, payload) =>
  new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'SEND_PARTNER_REQUEST', payload }, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!resp) return reject(new Error('Không nhận được phản hồi từ content script.'));
      if (!resp.ok) return reject(new Error(resp.error));
      resolve(resp);
    });
  });

const sendPartnerRequest = async ({ email, partnerId, pageIds, userId, businessId, fbDtsg, lsdToken, mutationIndex }) => {
  const tabId = await getFacebookTabId();

  try {
    return await sendMessage(tabId, { email, partnerId, pageIds, userId, businessId, fbDtsg, lsdToken, mutationIndex });
  } catch (err) {
    if (err.message.includes('Receiving end does not exist') || err.message.includes('Could not establish')) {
      await injectContentScript(tabId);
      await sleep(300);
      return await sendMessage(tabId, { email, partnerId, pageIds, userId, businessId, fbDtsg, lsdToken, mutationIndex });
    }
    throw err;
  }
};

const startSending = async () => {
  const emailRaw    = $('emailList').value.trim();
  const userId      = $('userId').value.trim();
  const businessId  = $('businessId').value.trim();
  const fbDtsg      = decodeURIComponent($('fbDtsg').value.trim());
  const lsdToken    = decodeURIComponent($('lsdToken').value.trim());
  const pageIds     = $('pageIds').value.split(',').map((p) => p.trim()).filter(Boolean);
  const partnerIds  = $('partnerIds').value.split(',').map((p) => p.trim()).filter(Boolean);
  const delayMs     = parseInt($('delayMs').value) || 2000;

  if (!emailRaw)              return log('⚠ Vui lòng nhập danh sách email.', 'warn');
  if (!userId)                return log('⚠ Vui lòng nhập User ID.', 'warn');
  if (!businessId)            return log('⚠ Vui lòng nhập Business ID.', 'warn');
  if (!fbDtsg)                return log('⚠ Vui lòng nhập fb_dtsg token.', 'warn');
  if (!lsdToken)              return log('⚠ Vui lòng nhập lsd token.', 'warn');
  if (pageIds.length === 0)   return log('⚠ Vui lòng nhập ít nhất 1 Page ID.', 'warn');
  if (partnerIds.length === 0) return log('⚠ Vui lòng nhập ít nhất 1 Partner Business ID.', 'warn');

  const emails = emailRaw.split('\n').map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) return log('⚠ Danh sách email trống.', 'warn');

  running = true;
  stats = { total: emails.length, ok: 0, fail: 0 };
  updateStats();
  updateProgress(0, emails.length);

  $('btnSend').disabled = true;
  $('btnSend').textContent = '⏳ Đang gửi...';

  log(`Bắt đầu gửi ${emails.length} email (${partnerIds.length} business ID xoay vòng)...`, 'info');

  for (let i = 0; i < emails.length; i++) {
    const email     = emails[i];
    const partnerId = partnerIds[i % partnerIds.length];
    log(`→ [${i + 1}/${emails.length}] ${email} → BM: ${partnerId}`, 'info');

    try {
      const result = await sendPartnerRequest({ email, partnerId, pageIds, userId, businessId, fbDtsg, lsdToken, mutationIndex: i + 1 });
      stats.ok++;
      log(`✓ Thành công: ${email}${result.canceled ? ' (đã hủy request)' : ''}`, 'success');
    } catch (err) {
      stats.fail++;
      log(`✗ Thất bại: ${email} — ${err.message}`, 'error');
    }

    updateStats();
    updateProgress(i + 1, emails.length);

    if (i < emails.length - 1) await sleep(delayMs);
  }

  running = false;
  $('btnSend').disabled = false;
  $('btnSend').textContent = '🚀 Bắt đầu gửi';

  log(`Hoàn tất! ✓ ${stats.ok} thành công, ✗ ${stats.fail} thất bại.`, stats.fail === 0 ? 'success' : 'warn');
};

$('btnSend').addEventListener('click', () => {
  if (!running) startSending();
});

$('btnClear').addEventListener('click', () => {
  $('logBox').innerHTML = '';
  stats = { total: 0, ok: 0, fail: 0 };
  updateStats();
  updateProgress(0, 0);
  $('progressText').textContent = 'Sẵn sàng';
});
