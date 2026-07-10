import { extractJobFromPage } from '../lib/extractJob.js';
import { parseBackendUrl, isValidUuid } from '../lib/validate.js';

const DEFAULT_BACKEND = 'http://localhost:8000';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  backendUrl:    DEFAULT_BACKEND,
  profiles:      [],   // [{ name: string, resumeId: string }]
  activeProfile: 0,    // index into profiles
  jobData:       null,
};

function activeResumeId() {
  return state.profiles[state.activeProfile]?.resumeId ?? null;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const panelSettings       = $('panel-settings');
const panelMain           = $('panel-main');
const panelResult         = $('panel-result');

const inputBackendUrl     = $('input-backend-url');
const inputProfileName    = $('input-profile-name');
const inputResumeFile     = $('input-resume-file');
const inputResumeId       = $('input-resume-id');
const btnSettingsToggle   = $('btn-settings-toggle');
const btnSaveSettings     = $('btn-save-settings');
const btnUploadAdd        = $('btn-upload-add');
const btnAddById          = $('btn-add-by-id');
const msgSettings         = $('msg-settings');
const msgAddProfile       = $('msg-add-profile');
const profileListEl       = $('profile-list');

const jobTitleEl          = $('job-title');
const jobCompanyEl        = $('job-company');
const jobDescPreview      = $('job-desc-preview');
const msgNoJob            = $('msg-no-job');
const activeProfileBadge  = $('active-profile-badge');
const apbName             = $('apb-name');
const apbId               = $('apb-id');
const btnSwitchProfile    = $('btn-switch-profile');
const profileSwitcher     = $('profile-switcher');
const btnTailor           = $('btn-tailor');
const msgMain             = $('msg-main');

const resultScore         = $('result-score');
const resultKeywords      = $('result-keywords');
const keywordsChips       = $('keywords-chips');
const resultRecs          = $('result-recs');
const recsList            = $('recs-list');
const btnOpenApp          = $('btn-open-app');
const btnTailorAgain      = $('btn-tailor-again');

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
  btnTailor.disabled = !(activeResumeId() && state.jobData?.description);
}

const FETCH_TIMEOUT_MS = 120_000;
const MAX_JD_CHARS     = 8000;

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
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
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

// ── Profile storage ───────────────────────────────────────────────────────────
async function persistProfiles() {
  await chrome.storage.local.set({
    profiles:           state.profiles,
    activeProfileIndex: state.activeProfile,
  });
}

// ── Render — profiles ─────────────────────────────────────────────────────────
function renderProfileList() {
  profileListEl.innerHTML = '';
  state.profiles.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = `profile-item${i === state.activeProfile ? ' active' : ''}`;

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'profile-select';

    const radio = document.createElement('span');
    radio.className = 'profile-radio';

    const info = document.createElement('div');
    info.className = 'profile-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'profile-name';
    nameEl.textContent = p.name;

    const idEl = document.createElement('span');
    idEl.className = 'profile-id mono';
    idEl.textContent = p.resumeId.slice(0, 22) + '…';

    info.append(nameEl, idEl);
    selectBtn.append(radio, info);
    selectBtn.addEventListener('click', () => setActiveProfile(i));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'profile-delete';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', `Remove ${p.name}`);
    delBtn.addEventListener('click', () => deleteProfile(i));

    li.append(selectBtn, delBtn);
    profileListEl.appendChild(li);
  });
}

function renderActiveBadge() {
  const profile = state.profiles[state.activeProfile];
  if (profile) {
    apbName.textContent = profile.name;
    apbId.textContent   = profile.resumeId.slice(0, 18) + '…';
    activeProfileBadge.hidden = false;
  } else {
    activeProfileBadge.hidden = true;
  }
}

function renderSwitcher() {
  profileSwitcher.innerHTML = '';
  state.profiles.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = `switcher-opt${i === state.activeProfile ? ' active' : ''}`;

    const dot = document.createElement('span');
    dot.className = 'switcher-dot';

    const name = document.createElement('span');
    name.className = 'switcher-name';
    name.textContent = p.name;

    li.append(dot, name);
    li.addEventListener('click', () => {
      setActiveProfile(i);
      profileSwitcher.hidden = true;
      btnSwitchProfile.textContent = 'Switch ▾';
    });
    profileSwitcher.appendChild(li);
  });
}

function renderAll() {
  renderProfileList();
  renderActiveBadge();
  renderSwitcher();
  updateTailorBtn();
}

// ── Profile actions ───────────────────────────────────────────────────────────
async function setActiveProfile(index) {
  state.activeProfile = index;
  await persistProfiles();
  renderAll();
}

async function addProfile(name, resumeId) {
  state.profiles.push({ name, resumeId });
  state.activeProfile = state.profiles.length - 1;
  await persistProfiles();
  renderAll();
}

async function deleteProfile(index) {
  state.profiles.splice(index, 1);
  if (state.activeProfile >= state.profiles.length) {
    state.activeProfile = Math.max(0, state.profiles.length - 1);
  }
  await persistProfiles();
  renderAll();
}

// ── Render — job data & results ───────────────────────────────────────────────
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
  if (!panelSettings.hidden) profileSwitcher.hidden = true;
});

btnSaveSettings.addEventListener('click', async () => {
  const urlResult = parseBackendUrl(inputBackendUrl.value, DEFAULT_BACKEND);
  if (urlResult.error) {
    showMsg(msgSettings, urlResult.error, 'error');
    return;
  }
  state.backendUrl = urlResult.url;
  inputBackendUrl.value = urlResult.url;
  await chrome.storage.local.set({ backendUrl: urlResult.url });
  showMsg(msgSettings, 'Backend URL saved.', 'success');
  setTimeout(() => hideMsg(msgSettings), 1500);
});

btnUploadAdd.addEventListener('click', async () => {
  const name = inputProfileName.value.trim();
  const file = inputResumeFile.files?.[0];
  if (!name) { showMsg(msgAddProfile, 'Enter a profile name.', 'error'); return; }
  if (!file) { showMsg(msgAddProfile, 'Select a PDF or DOCX file.', 'error'); return; }
  hideMsg(msgAddProfile);
  btnUploadAdd.disabled = true;
  try {
    const data = await apiUploadFile(file);
    await addProfile(name, data.resume_id);
    inputProfileName.value = '';
    inputResumeFile.value  = '';
    showMsg(msgAddProfile, `"${name}" uploaded and selected.`, 'success');
  } catch (e) {
    showMsg(msgAddProfile, `Upload failed: ${e.message}`, 'error');
  } finally {
    btnUploadAdd.disabled = false;
  }
});

btnAddById.addEventListener('click', async () => {
  const name     = inputProfileName.value.trim();
  const resumeId = inputResumeId.value.trim();
  if (!name)               { showMsg(msgAddProfile, 'Enter a profile name.', 'error'); return; }
  if (!isValidUuid(resumeId)) { showMsg(msgAddProfile, 'Resume ID must be a valid UUID.', 'error'); return; }
  await addProfile(name, resumeId);
  inputProfileName.value = '';
  inputResumeId.value    = '';
  showMsg(msgAddProfile, `"${name}" added and selected.`, 'success');
});

// ── Profile switcher (main panel) ─────────────────────────────────────────────
btnSwitchProfile.addEventListener('click', () => {
  const opening = profileSwitcher.hidden;
  profileSwitcher.hidden = !opening;
  btnSwitchProfile.innerHTML = opening ? 'Switch &#9652;' : 'Switch &#9662;';
});

// ── Tailor flow ───────────────────────────────────────────────────────────────
btnTailor.addEventListener('click', async () => {
  profileSwitcher.hidden = true;
  btnSwitchProfile.innerHTML = 'Switch &#9662;';
  hideMsg(msgMain);
  setLoading(true, 'Uploading job…');

  let jobId = null;
  try {
    const description = state.jobData.description.slice(0, MAX_JD_CHARS);
    const jobRes = await apiPost('/api/v1/jobs/upload', {
      job_descriptions: [description],
      resume_id: activeResumeId(),
    });
    if (!jobRes.job_id?.length) throw new Error('Backend returned no job ID.');
    jobId = jobRes.job_id[0];

    setLoading(true, 'Tailoring resume…');
    const improveRes = await apiPost('/api/v1/resumes/improve', {
      resume_id: activeResumeId(),
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
  const stored = await chrome.storage.local.get([
    'backendUrl', 'profiles', 'activeProfileIndex',
    'resumeId',  // legacy key — migrate below
  ]);

  state.backendUrl = stored.backendUrl || DEFAULT_BACKEND;
  inputBackendUrl.value = state.backendUrl;

  // Migrate legacy single resumeId → profiles array
  if (!stored.profiles && stored.resumeId) {
    state.profiles = [{ name: 'Default', resumeId: stored.resumeId }];
    await chrome.storage.local.set({ profiles: state.profiles, activeProfileIndex: 0 });
    await chrome.storage.local.remove('resumeId');
  } else {
    state.profiles = stored.profiles || [];
  }

  state.activeProfile = stored.activeProfileIndex ?? 0;
  if (state.activeProfile >= state.profiles.length) state.activeProfile = 0;

  renderAll();

  // First-time setup: open settings automatically
  if (state.profiles.length === 0) panelSettings.hidden = false;

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
    if (!e.message?.includes('Cannot access')) {
      console.warn('[Resume Matcher] Job extraction failed:', e.message);
    }
  }

  renderJobData(state.jobData);
  updateTailorBtn();
}

init();
