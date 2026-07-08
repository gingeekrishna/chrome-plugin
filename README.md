<div align="center">

# Resume Matcher — Chrome Extension

One-click resume tailoring directly from any job posting.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-1d4ed8?labelColor=F0F0E8&style=for-the-badge)
![Tests](https://img.shields.io/badge/Tests-29%20passing-1d4ed8?labelColor=F0F0E8&style=for-the-badge)
![License](https://img.shields.io/badge/License-Apache%202.0-1d4ed8?labelColor=F0F0E8&style=for-the-badge)

A companion extension for [Resume Matcher](https://github.com/srbhr/Resume-Matcher). Detects the job description on the current page, sends it to your local Resume Matcher backend, and shows your ATS score, missing keywords, and improvement recommendations — without leaving the job board.

</div>

---

## Supported Job Boards

| Job Board | Auto-detected |
|-----------|:---:|
| LinkedIn | ✓ |
| Indeed | ✓ |
| Greenhouse | ✓ |
| Lever | ✓ |
| Glassdoor | ✓ |
| Workday / myworkdayjobs | ✓ |
| Any other page | Generic fallback |

---

## Prerequisites

- **Chrome 114+** (Manifest V3 support)
- **Resume Matcher backend** running on `http://localhost:8000`
  ```bash
  uv run uvicorn app.main:app --port 8000
  ```
- **Resume Matcher frontend** (optional, for viewing full results) on `http://localhost:3000`
  ```bash
  cd apps/frontend && npm run dev
  ```

---

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the root of this repository (the folder containing `manifest.json`)
5. The Resume Matcher icon appears in your Chrome toolbar

---

## First-Time Setup

1. Click the extension icon — the **Settings** panel opens automatically
2. **Backend URL** — leave as `http://localhost:8000` unless you changed the port
3. **Resume** — upload your master resume PDF or DOCX; the returned Resume ID is saved locally
4. Click **Save**

From then on, navigate to any supported job posting and click **Tailor Resume**.

---

## How It Works

```
Job page  →  extractJobFromPage()  →  POST /api/v1/jobs/upload
                                   →  POST /api/v1/resumes/improve
                                   →  ATS score · missing keywords · recommendations
```

1. The extension reads the job title, company, and description from the active tab
2. Sends the job description (truncated to 8 000 chars) to the backend
3. Displays the ATS score colour-coded (green ≥ 80 · amber ≥ 60 · red < 60), missing keywords as chips, and improvement recommendations
4. **Open in Resume Matcher** opens the frontend on port 3000

---

## Project Structure

```
manifest.json          MV3 manifest (permissions: activeTab, storage, scripting)
popup/
  popup.html           Extension popup UI
  popup.css            Swiss International Style
  popup.js             UI wiring — imports from lib/
lib/
  extractJob.js        Self-contained job extractor (injected into the active tab)
  validate.js          URL and UUID validation helpers
tests/
  extractJob.test.js   21 Jest tests — all 6 job boards + generic fallback
  validate.test.js     15 Jest tests — URL format, localhost restriction, UUID format
docs/
  local-setup.md       Full setup and troubleshooting guide
  testing.md           Unit test guide + manual testing checklist
```

---

## Development

```bash
# Install test dependencies
npm install

# Run unit tests (29 tests, no browser required)
npm test
```

Tests use [Jest](https://jestjs.io/) + [jest-environment-jsdom](https://jestjs.io/docs/configuration#testenvironment-string). No bundler or transpiler needed — the project uses Node's native ES module support.

See [docs/testing.md](docs/testing.md) for the full manual testing checklist.

---

## Contributing

This extension is part of the Resume Matcher ecosystem. Please read the contributing guidelines in the [main repository](https://github.com/srbhr/Resume-Matcher) before opening a pull request.

- For bugs and feature requests, open an issue in this repository
- For questions about Resume Matcher itself, join the community on [Discord](https://dsc.gg/resume-matcher)
