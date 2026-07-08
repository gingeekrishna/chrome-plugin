# Testing

## Unit tests

Pure JavaScript logic is tested with [Jest](https://jestjs.io/) and [jest-environment-jsdom](https://jestjs.io/docs/configuration#testenvironment-string).

No Babel transform is needed — the project uses Node's native ES module support via `--experimental-vm-modules`.

### Install

```bash
npm install
```

### Run

```bash
npm test
```

### What is covered

| Test file | What it tests |
|---|---|
| `tests/extractJob.test.js` | `extractJobFromPage` — per-board selector logic for LinkedIn, Indeed, Greenhouse, Lever, Glassdoor, Workday, and the generic fallback |
| `tests/validate.test.js` | `parseBackendUrl` (URL format, protocol, localhost restriction, trailing-slash stripping, empty fallback) and `isValidUuid` |

### What is NOT unit-tested (and why)

- **Chrome API interactions** (`chrome.storage`, `chrome.scripting`, `chrome.tabs`) — these require a real extension context or a Chrome test framework like [Puppeteer](https://pptr.dev/) running against a real browser. The Chrome APIs are thin wrappers around the testable logic (which is tested above).
- **Popup DOM wiring** (button clicks, panel visibility) — covered by manual testing below.

---

## Manual testing checklist

Run through this whenever you change `popup.js`, `popup.html`, or `popup.css`.

### Settings panel

- [ ] Opens automatically on first launch (no Resume ID stored)
- [ ] Saves valid `http://localhost:8000` URL without error
- [ ] Rejects a non-localhost URL with the correct error message
- [ ] Rejects an invalid URL (e.g. `not-a-url`) with error
- [ ] Rejects a malformed UUID Resume ID
- [ ] Accepts a valid UUID Resume ID
- [ ] Resume ID badge appears in the main panel after saving

### Job extraction

- [ ] LinkedIn job page: title, company, and description are detected
- [ ] Indeed job page: title, company, and description are detected
- [ ] Greenhouse job page: title and description are detected
- [ ] Lever job page: title and company are detected
- [ ] Glassdoor job page: title and company are detected
- [ ] Workday job page: title and company are detected
- [ ] Non-job page (e.g. `google.com`): "No job description detected" message appears

### Tailor flow

- [ ] **Tailor Resume** button is disabled until both Resume ID and a job description are present
- [ ] Clicking **Tailor Resume** shows the loading overlay with "Uploading job…" then "Tailoring resume…"
- [ ] On success: result panel shows ATS score, missing keywords, and recommendations
- [ ] ATS score colours: ≥80 green, 60–79 amber, <60 red
- [ ] **Open in Resume Matcher** opens `http://localhost:3000` in a new tab
- [ ] **Tailor Another** returns to the main panel and re-extracts the job from the current tab
- [ ] On API error: error message appears below the button; loading overlay is dismissed

### Upload

- [ ] Uploading a `.pdf` file succeeds and stores the Resume ID
- [ ] Uploading a `.docx` file succeeds and stores the Resume ID
- [ ] Uploading an unsupported file type shows "Only PDF and DOCX files are supported."
- [ ] Upload timeout (backend takes >120 s) shows "Upload timed out."
