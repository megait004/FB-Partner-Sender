const cancelRequest = ({ businessId, userId, requestId, fbDtsg, lsdToken, mutationIndex }) => {
  const bodyParams = new URLSearchParams({
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
      'accept': '*/*',
      'content-type': 'application/x-www-form-urlencoded',
      'x-fb-friendly-name': 'BusinessCometBizSuiteDeleteRequestMutation',
      'x-fb-lsd': lsdToken,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    },
    referrer: `https://business.facebook.com/latest/settings/partners?business_id=${businessId}`,
    body: bodyParams.toString(),
    mode: 'cors',
    credentials: 'include',
  });
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'SEND_PARTNER_REQUEST') return;

  const { email, partnerId, pageIds, userId, businessId, fbDtsg, lsdToken, mutationIndex } = msg.payload;

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

  const bodyParams = new URLSearchParams({
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

  fetch('https://business.facebook.com/api/graphql/?_callFlowletID=24604&_triggerFlowletID=24601&qpl_active_e2e_trace_ids=', {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'accept-language': 'vi-VN,vi;q=0.9',
      'content-type': 'application/x-www-form-urlencoded',
      'x-fb-friendly-name': 'BusinessCometRequestAssetShareMutation',
      'x-fb-lsd': lsdToken,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    },
    referrer: `https://business.facebook.com/latest/settings/partners?business_id=${businessId}`,
    body: bodyParams.toString(),
    mode: 'cors',
    credentials: 'include',
  })
    .then(async (resp) => {
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
        await cancelRequest({ businessId, userId, requestId, fbDtsg, lsdToken, mutationIndex });
        sendResponse({ ok: true, canceled: true });
      } else {
        sendResponse({ ok: true, canceled: false });
      }
    })
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true;
});

