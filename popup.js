const $ = id => document.getElementById(id);

const SAVE_FIELDS = ['userId', 'businessId', 'fbDtsg', 'lsdToken', 'pageIds', 'partnerIds', 'delayMs', 'emailList'];

const DEFAULTS = {
  businessId: '1230772795911914',
  pageIds: '556750461849806',
};

const saveForm = () => SAVE_FIELDS.forEach(id => localStorage.setItem(id, $(id).value));

const loadForm = () => {
  SAVE_FIELDS.forEach(id => {
    const val = localStorage.getItem(id);
    $(id).value = val !== null ? val : (DEFAULTS[id] || '');
  });
};

document.addEventListener('DOMContentLoaded', () => {
  loadForm();
  SAVE_FIELDS.forEach(id => $(id).addEventListener('input', saveForm));
});

const log = (msg, type = 'info') => {
  const box = $('logBox');
  const line = document.createElement('div');
  line.className = `log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
};

const getFacebookTabId = () =>
  new Promise((resolve, reject) => {
    chrome.tabs.query({ url: 'https://business.facebook.com/*' }, tabs => {
      if (!tabs.length) reject(new Error('Chưa mở tab business.facebook.com. Vui lòng mở trang trước.'));
      else resolve(tabs[0].id);
    });
  });

const injectContentScript = tabId =>
  chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });

const launchSending = async () => {
  saveForm();

  const emailRaw   = $('emailList').value.trim();
  const userId     = $('userId').value.trim();
  const businessId = $('businessId').value.trim();
  const fbDtsg     = decodeURIComponent($('fbDtsg').value.trim());
  const lsdToken   = decodeURIComponent($('lsdToken').value.trim());
  const pageIds    = $('pageIds').value.split(',').map(p => p.trim()).filter(Boolean);
  const partnerIds = $('partnerIds').value.split(',').map(p => p.trim()).filter(Boolean);
  const delayMs    = parseInt($('delayMs').value) || 2000;

  if (!emailRaw)          return log('⚠ Vui lòng nhập danh sách email.', 'warn');
  if (!userId)            return log('⚠ Vui lòng nhập User ID.', 'warn');
  if (!businessId)        return log('⚠ Vui lòng nhập Business ID.', 'warn');
  if (!fbDtsg)            return log('⚠ Vui lòng nhập fb_dtsg token.', 'warn');
  if (!lsdToken)          return log('⚠ Vui lòng nhập lsd token.', 'warn');
  if (!pageIds.length)    return log('⚠ Vui lòng nhập ít nhất 1 Page ID.', 'warn');
  if (!partnerIds.length) return log('⚠ Vui lòng nhập ít nhất 1 Partner Business ID.', 'warn');

  const emails = emailRaw.split('\n').map(e => e.trim()).filter(Boolean);
  if (!emails.length) return log('⚠ Danh sách email trống.', 'warn');

  let tabId;
  try {
    tabId = await getFacebookTabId();
  } catch (err) {
    return log('✗ ' + err.message, 'error');
  }

  const payload = { emails, userId, businessId, fbDtsg, lsdToken, pageIds, partnerIds, delayMs };

  const doLaunch = () =>
    new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'START_SENDING', payload }, resp => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!resp?.ok) return reject(new Error(resp?.error || 'Lỗi không xác định'));
        resolve(resp);
      });
    });

  const tryLaunch = async () => {
    try {
      await doLaunch();
    } catch (err) {
      if (err.message.includes('Receiving end does not exist') || err.message.includes('Could not establish')) {
        await injectContentScript(tabId);
        await new Promise(r => setTimeout(r, 400));
        await doLaunch();
      } else {
        throw err;
      }
    }
  };

  $('btnSend').disabled = true;
  $('btnSend').textContent = '⏳ Đang khởi động...';

  try {
    await tryLaunch();
    log(`✓ Đã mở panel gửi trên trang (${emails.length} email). Có thể đóng popup này.`, 'success');
    $('btnSend').textContent = '✓ Đang gửi trên trang';
    setTimeout(() => {
      $('btnSend').disabled = false;
      $('btnSend').textContent = '🚀 Bắt đầu gửi';
    }, 3000);
  } catch (err) {
    log('✗ ' + err.message, 'error');
    $('btnSend').disabled = false;
    $('btnSend').textContent = '🚀 Bắt đầu gửi';
  }
};

const autoFetchTokens = async () => {
  const btn = $('btnAutoToken');
  btn.disabled = true;
  btn.textContent = '⏳ Đang lấy...';

  let tabId;
  try {
    tabId = await getFacebookTabId();
  } catch (err) {
    log('✗ ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = '⚡ Tự động lấy token';
    return;
  }

  const doGetTokens = () =>
    new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'GET_TOKENS' }, resp => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(resp);
      });
    });

  try {
    let resp;
    try {
      resp = await doGetTokens();
    } catch (err) {
      if (err.message.includes('Receiving end does not exist') || err.message.includes('Could not establish')) {
        await injectContentScript(tabId);
        await new Promise(r => setTimeout(r, 400));
        resp = await doGetTokens();
      } else {
        throw err;
      }
    }

    if (!resp?.ok) throw new Error(resp?.error || 'Không lấy được token');

    const filled = [];
    if (resp.fbDtsg)   { $('fbDtsg').value   = resp.fbDtsg;   filled.push('fb_dtsg'); }
    if (resp.lsdToken) { $('lsdToken').value  = resp.lsdToken; filled.push('lsd'); }
    if (resp.userId)   { $('userId').value    = resp.userId;   filled.push('userId'); }

    saveForm();

    if (filled.length) {
      log(`✓ Đã tự động điền: ${filled.join(', ')}`, 'success');
      btn.textContent = '✓ Đã lấy xong';
    } else {
      log('⚠ Không tìm thấy token — hãy mở tab business.facebook.com trước và tải lại trang.', 'warn');
      btn.textContent = '⚡ Tự động lấy token';
    }
  } catch (err) {
    log('✗ ' + err.message, 'error');
    btn.textContent = '⚡ Tự động lấy token';
  }

  btn.disabled = false;
  setTimeout(() => {
    if (btn.textContent === '✓ Đã lấy xong') btn.textContent = '⚡ Tự động lấy token';
  }, 3000);
};

$('btnAutoToken').addEventListener('click', autoFetchTokens);

$('btnSend').addEventListener('click', launchSending);

$('btnClear').addEventListener('click', () => {
  $('logBox').innerHTML = '';
});
