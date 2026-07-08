# Local Setup

## Prerequisites

- Chrome 114+ (Manifest V3 support)
- Resume-Matcher backend running locally (`uv run uvicorn app.main:app --port 8000`)
- Optionally, the Resume-Matcher frontend running locally (`npm run dev` on port 3000)

## Load the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the root of this repository (the folder containing `manifest.json`)
5. The Resume Matcher icon appears in the Chrome toolbar

## First-time setup inside the popup

1. Click the extension icon to open the popup
2. The **Settings** panel opens automatically on first launch
3. **Backend URL** — leave as `http://localhost:8000` if the backend runs on the default port
4. **Resume** — upload your master resume PDF or DOCX once; the extension stores the returned Resume ID in `chrome.storage.local`
5. Click **Save**

## Using the extension

1. Navigate to a job posting on LinkedIn, Indeed, Greenhouse, Lever, Glassdoor, or Workday
2. Open the popup — the job title, company, and a description preview appear automatically
3. Click **Tailor Resume**
4. The extension sends the job description to the backend and displays:
   - ATS score (colour-coded green / amber / red)
   - Missing keywords as chips
   - Improvement recommendations
5. Click **Open in Resume Matcher** to view the full result in the frontend

## Reloading after code changes

After editing any source file, go to `chrome://extensions` and click the **refresh** icon on the Resume Matcher card. Then close and reopen the popup.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Cannot reach backend" | Backend not running | Run `uv run uvicorn app.main:app --port 8000` |
| "No job description detected" | Unsupported job board | Supported: LinkedIn, Indeed, Greenhouse, Lever, Glassdoor, Workday |
| Popup shows blank | Script error at load | Open DevTools on the popup: right-click the popup → **Inspect** |
| Settings not saving | Extension needs reload | Refresh it at `chrome://extensions` |
