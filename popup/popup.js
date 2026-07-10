import { extractJobFromPage } from '../lib/extractJob.js';
import { parseBackendUrl, isValidUuid } from '../lib/validate.js';

const DEFAULT_BACKEND = 'http://localhost:8000';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  backendUrl: DEFAULT_BACKEND,
  resumeId: null,
  jobData: null,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const panelSettings     = $('panel-settings');
const panelMain         = $('panel-main');
const panelResult       = $('panel-result');

const inputBackendUrl   = $('input-backend-url');
const inputResumeFile   = $('input-resume-file');
const inputResumeId     = $('input-resume-id');
const btnSettingsToggle = $('btn-settings-toggle');
const btnUploadResume   = $('btn-upload-resume');
const btnSaveSettings   = $('btn-save-settings');
const msgSettings       = $('msg-settings');

const jobTitleEl        = $('job-title');
const jobCompanyEl      = $('job-company');
const jobDescPreview    = $('job-desc-preview');
const msgNoJob          = $('msg-no-job');
const resumeBadge       = $('resume-badge');
const badgeResumeId     = $('badge-resume-id');
const btnTailor         = $('btn-tailor');
const btnQuickScan      = $('btn-quick-scan');
const msgMain           = $('msg-main');

const panelScan         = $('panel-scan');
const scanJobTitle      = $('scan-job-title');
const scanPct           = $('scan-pct');
const scanBarFill       = $('scan-bar-fill');
const scanFound         = $('scan-found');
const scanFoundLabel    = $('scan-found-label');
const scanFoundChips    = $('scan-found-chips');
const scanMissing       = $('scan-missing');
const scanMissingLabel  = $('scan-missing-label');
const scanMissingChips  = $('scan-missing-chips');
const btnScanBack       = $('btn-scan-back');
const btnScanTailor     = $('btn-scan-tailor');
const msgScan           = $('msg-scan');

const resultScore       = $('result-score');
const resultKeywords    = $('result-keywords');
const keywordsChips     = $('keywords-chips');
const resultRecs        = $('result-recs');
const recsList          = $('recs-list');
const btnOpenApp        = $('btn-open-app');
const btnTailorAgain    = $('btn-tailor-again');

// ── Helpers ───────────────────────────────────────────────────────────────────
function showMsg(el, text, type = '') {
  el.textContent = text;
  el.className = `msg ${type}`;
  el.hidden = false;
}

function hideMsg(el) {
  el.hidden = true;
}

let loadingOverlay = null;

function setLoading(on, label = 'Working…') {
  if (on) {
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'loading-overlay';
      document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.textContent = label;
    loadingOverlay.style.display = 'flex';
    btnTailor.disabled = true;
  } else {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    updateTailorBtn();
  }
}

function updateTailorBtn() {
  const ready = !!(state.resumeId && state.jobData?.description);
  btnTailor.disabled    = !ready;
  btnQuickScan.disabled = !ready;
}

const FETCH_TIMEOUT_MS = 120_000; // 2 min — LLM calls can be slow

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ── API ───────────────────────────────────────────────────────────────────────
async function apiPost(path, body) {
  let res;
  try {
    res = await fetchWithTimeout(`${state.backendUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request timed out. The backend may be busy.');
    throw new Error(
      `Cannot reach backend at ${state.backendUrl}. Make sure it is running (uv run uvicorn app.main:app --port 8000).`
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiUploadFile(file) {
  const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only PDF and DOCX files are supported.');
  }
  const form = new FormData();
  form.append('file', file);
  let res;
  try {
    res = await fetchWithTimeout(`${state.backendUrl}/api/v1/resumes/upload`, {
      method: 'POST',
      body: form,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Upload timed out.');
    throw new Error(`Cannot reach backend at ${state.backendUrl}.`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderResumeId() {
  if (state.resumeId) {
    badgeResumeId.textContent = state.resumeId;
    resumeBadge.hidden = false;
  } else {
    resumeBadge.hidden = true;
  }
}

function renderJobData(job) {
  const hasContent = job?.description?.trim();
  jobTitleEl.textContent     = hasContent ? (job.title   || '(Title not detected)') : '';
  jobCompanyEl.textContent   = hasContent ? (job.company || '') : '';
  jobDescPreview.textContent = hasContent
    ? job.description.slice(0, 280) + (job.description.length > 280 ? '…' : '')
    : '';
  msgNoJob.hidden = Boolean(hasContent);
}

function renderResult(data) {
  const ats   = data.ats_score ?? null;
  const score = ats?.overall_score ?? data.new_score ?? null;

  if (score !== null && Number.isFinite(score)) {
    resultScore.textContent = score.toFixed(1);
    resultScore.className = `score-value ${score >= 80 ? 'good' : score >= 60 ? 'ok' : 'bad'}`;
  } else {
    resultScore.textContent = '—';
    resultScore.className = 'score-value';
  }

  if (ats?.missing_keywords?.length) {
    keywordsChips.innerHTML = '';
    ats.missing_keywords.forEach((kw) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = kw;
      keywordsChips.appendChild(chip);
    });
    resultKeywords.hidden = false;
  } else {
    resultKeywords.hidden = true;
  }

  if (ats?.recommendations?.length) {
    recsList.innerHTML = '';
    ats.recommendations.forEach((tip) => {
      const li = document.createElement('li');
      li.textContent = tip;
      recsList.appendChild(li);
    });
    resultRecs.hidden = false;
  } else {
    resultRecs.hidden = true;
  }
}

// ── Settings handlers ─────────────────────────────────────────────────────────
btnSettingsToggle.addEventListener('click', () => {
  panelSettings.hidden = !panelSettings.hidden;
});

btnUploadResume.addEventListener('click', async () => {
  const file = inputResumeFile.files?.[0];
  if (!file) {
    showMsg(msgSettings, 'Select a PDF or DOCX file first.', 'error');
    return;
  }
  hideMsg(msgSettings);
  setLoading(true, 'Uploading resume…');
  try {
    const data = await apiUploadFile(file);
    const resumeId = data.resume_id;
    await chrome.storage.local.set({ resumeId });
    state.resumeId = resumeId;
    inputResumeId.value = resumeId;
    showMsg(msgSettings, `Uploaded. Resume ID saved.`, 'success');
    renderResumeId();
    updateTailorBtn();
    setTimeout(() => { panelSettings.hidden = true; }, 1800);
  } catch (e) {
    showMsg(msgSettings, `Upload failed: ${e.message}`, 'error');
  } finally {
    setLoading(false);
  }
});

btnSaveSettings.addEventListener('click', async () => {
  const resumeId = inputResumeId.value.trim();

  const urlResult = parseBackendUrl(inputBackendUrl.value, DEFAULT_BACKEND);
  if (urlResult.error) {
    showMsg(msgSettings, urlResult.error, 'error');
    return;
  }
  const backendUrl = urlResult.url;

  if (resumeId && !isValidUuid(resumeId)) {
    showMsg(msgSettings, 'Resume ID must be a valid UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).', 'error');
    return;
  }

  await chrome.storage.local.set({ backendUrl, resumeId: resumeId || null });
  state.backendUrl = backendUrl;
  state.resumeId   = resumeId || null;
  inputBackendUrl.value = backendUrl;

  showMsg(msgSettings, 'Settings saved.', 'success');
  renderResumeId();
  updateTailorBtn();
  setTimeout(() => { panelSettings.hidden = true; }, 1000);
});

// ── Keyword scan flow ─────────────────────────────────────────────────────────
const MAX_JD_CHARS = 8000;

function renderScanPanel(data) {
  scanJobTitle.textContent = state.jobData?.title || 'Keyword Scan';

  const pct       = Math.round(data.match_score ?? 0);
  const colorCls  = pct >= 75 ? 'good' : pct >= 50 ? 'ok' : 'bad';
  scanPct.textContent = pct;
  scanPct.className   = `scan-pct ${colorCls}`;
  scanBarFill.style.width = `${pct}%`;
  scanBarFill.className   = `scan-bar-fill ${colorCls}`;

  function fillChips(container, labelEl, groupEl, keywords, chipClass, labelText) {
    if (keywords?.length) {
      container.innerHTML = '';
      keywords.forEach((kw) => {
        const chip = document.createElement('span');
        chip.className   = `kw-chip ${chipClass}`;
        chip.textContent = kw;
        container.appendChild(chip);
      });
      labelEl.textContent = `${labelText} (${keywords.length})`;
      groupEl.hidden = false;
    } else {
      groupEl.hidden = true;
    }
  }

  fillChips(scanFoundChips,   scanFoundLabel,   scanFound,   data.matched_keywords, 'kw-chip-found',   'Found in your resume');
  fillChips(scanMissingChips, scanMissingLabel, scanMissing, data.missing_keywords,  'kw-chip-missing', 'Missing — add these');
}

btnQuickScan.addEventListener('click', async () => {
  hideMsg(msgMain);
  setLoading(true, 'Scanning keywords…');

  try {
    const description = state.jobData.description.slice(0, MAX_JD_CHARS);
    const jobRes = await apiPost('/api/v1/jobs/upload', {
      job_descriptions: [description],
      resume_id: state.resumeId,
    });
    if (!jobRes.job_id?.length) throw new Error('Backend returned no job ID.');
    const jobId = jobRes.job_id[0];

    const scanRes = await apiPost('/api/v1/resumes/ats-score', {
      resume_id: state.resumeId,
      job_id:    jobId,
    });

    renderScanPanel(scanRes);
    panelMain.hidden = true;
    panelScan.hidden = false;
  } catch (e) {
    showMsg(msgMain, `Scan failed: ${e.message}`, 'error');
  } finally {
    setLoading(false);
  }
});

btnScanBack.addEventListener('click', () => {
  panelScan.hidden = true;
  panelMain.hidden = false;
  hideMsg(msgScan);
});

btnScanTailor.addEventListener('click', () => {
  panelScan.hidden = true;
  panelMain.hidden = false;
  btnTailor.click();
});

// ── Tailor flow ───────────────────────────────────────────────────────────────
btnTailor.addEventListener('click', async () => {
  hideMsg(msgMain);
  setLoading(true, 'Uploading job…');

  let jobId = null;
  try {
    const description = state.jobData.description.slice(0, MAX_JD_CHARS);
    const jobRes = await apiPost('/api/v1/jobs/upload', {
      job_descriptions: [description],
      resume_id: state.resumeId,
    });
    if (!jobRes.job_id?.length) throw new Error('Backend returned no job ID.');
    jobId = jobRes.job_id[0];

    setLoading(true, 'Tailoring resume…');
    const improveRes = await apiPost('/api/v1/resumes/improve', {
      resume_id: state.resumeId,
      job_id:    jobId,
    });

    const resultData = improveRes.data ?? improveRes;
    panelMain.hidden   = true;
    panelResult.hidden = false;
    renderResult(resultData);
  } catch (e) {
    const detail = jobId
      ? `Tailoring failed (job ID: ${jobId} was created). ${e.message}`
      : e.message;
    showMsg(msgMain, detail, 'error');
  } finally {
    setLoading(false);
  }
});

btnOpenApp.addEventListener('click', () => {
  try {
    const parsed      = new URL(state.backendUrl);
    const frontendUrl = `${parsed.protocol}//${parsed.hostname}:3000`;
    chrome.tabs.create({ url: frontendUrl });
  } catch {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  }
});

btnTailorAgain.addEventListener('click', () => {
  panelResult.hidden = true;
  panelMain.hidden   = false;
  // Re-extract job from the active tab so stale job data doesn't linger
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (!tab?.id) return;
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, func: extractJobFromPage })
      .then(([result]) => {
        state.jobData = result?.result ?? null;
        renderJobData(state.jobData);
        updateTailorBtn();
      })
      .catch((e) => {
        console.warn('[Resume Matcher] Re-extraction failed:', e.message);
        showMsg(msgMain, 'Could not re-extract job details. Showing previous data.', 'error');
      });
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const stored = await chrome.storage.local.get(['backendUrl', 'resumeId']);
  state.backendUrl = stored.backendUrl || DEFAULT_BACKEND;
  state.resumeId   = stored.resumeId  || null;

  inputBackendUrl.value = state.backendUrl;
  if (state.resumeId) inputResumeId.value = state.resumeId;

  renderResumeId();

  // First-time setup: open settings automatically
  if (!state.resumeId) panelSettings.hidden = false;

  // Extract job description from the active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func:   extractJobFromPage,
      });
      state.jobData = result?.result ?? null;
    }
  } catch (e) {
    // Tab is a browser-internal page (chrome://, etc.) or scripting is blocked
    if (!e.message?.includes('Cannot access')) {
      console.warn('[Resume Matcher] Job extraction failed:', e.message);
    }
  }

  renderJobData(state.jobData);
  updateTailorBtn();
}

init();
