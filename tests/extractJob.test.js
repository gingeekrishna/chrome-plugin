import { extractJobFromPage } from '../lib/extractJob.js';

function setHostname(hostname) {
  Object.defineProperty(window, 'location', {
    value: { hostname },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.title = '';
});

// ── LinkedIn ──────────────────────────────────────────────────────────────────
describe('LinkedIn', () => {
  beforeEach(() => setHostname('www.linkedin.com'));

  test('extracts title, company, description', () => {
    document.body.innerHTML = `
      <h1 class="t-24">Frontend Engineer</h1>
      <span class="job-details-jobs-unified-top-card__company-name">
        <a>Acme Corp</a>
      </span>
      <div class="jobs-description-content__text">We are hiring a frontend engineer.</div>
    `;
    const result = extractJobFromPage();
    expect(result.source).toBe('LinkedIn');
    expect(result.title).toBe('Frontend Engineer');
    expect(result.company).toBe('Acme Corp');
    expect(result.description).toBe('We are hiring a frontend engineer.');
  });

  test('falls back to secondary title selector', () => {
    document.body.innerHTML = `
      <div class="job-details-jobs-unified-top-card__job-title"><h1>Staff Engineer</h1></div>
      <span class="job-details-jobs-unified-top-card__company-name"><a>BigCo</a></span>
      <div class="jobs-description__content">Staff-level engineering role.</div>
    `;
    const result = extractJobFromPage();
    expect(result.title).toBe('Staff Engineer');
    expect(result.description).toBe('Staff-level engineering role.');
  });

  test('returns empty strings when elements are absent', () => {
    document.body.innerHTML = '<div>unrelated content</div>';
    const result = extractJobFromPage();
    expect(result.source).toBe('LinkedIn');
    expect(result.title).toBe('');
    expect(result.company).toBe('');
    expect(result.description).toBe('');
  });
});

// ── Indeed ────────────────────────────────────────────────────────────────────
describe('Indeed', () => {
  beforeEach(() => setHostname('www.indeed.com'));

  test('extracts with data-testid selectors', () => {
    document.body.innerHTML = `
      <h1 data-testid="jobsearch-JobInfoHeader-title">Backend Developer</h1>
      <div data-company-name="true">TechStart</div>
      <div id="jobDescriptionText">Backend developer job description here.</div>
    `;
    const result = extractJobFromPage();
    expect(result.source).toBe('Indeed');
    expect(result.title).toBe('Backend Developer');
    expect(result.company).toBe('TechStart');
    expect(result.description).toBe('Backend developer job description here.');
  });

  test('falls back to class-based title selector', () => {
    document.body.innerHTML = `
      <h1 class="jobsearch-JobInfoHeader-title">Senior QA</h1>
      <div id="jobDescriptionText">QA role description.</div>
    `;
    const result = extractJobFromPage();
    expect(result.title).toBe('Senior QA');
  });
});

// ── Greenhouse ────────────────────────────────────────────────────────────────
describe('Greenhouse', () => {
  beforeEach(() => setHostname('boards.greenhouse.io'));

  test('extracts with .app-title and .company-name', () => {
    document.body.innerHTML = `
      <h1 class="app-title">Data Scientist</h1>
      <span class="company-name">DeepMind</span>
      <div id="content">Exciting data science role.</div>
    `;
    const result = extractJobFromPage();
    expect(result.source).toBe('Greenhouse');
    expect(result.title).toBe('Data Scientist');
    expect(result.company).toBe('DeepMind');
    expect(result.description).toBe('Exciting data science role.');
  });

  test('derives company from document title when .company-name absent', () => {
    document.title = 'ML Engineer at OpenAI';
    document.body.innerHTML = `
      <h1 class="app-title">ML Engineer</h1>
      <div id="content">Role description.</div>
    `;
    const result = extractJobFromPage();
    expect(result.company).toBe('OpenAI');
  });
});

// ── Lever ─────────────────────────────────────────────────────────────────────
describe('Lever', () => {
  beforeEach(() => setHostname('jobs.lever.co'));

  test('extracts from Lever layout', () => {
    document.body.innerHTML = `
      <div class="posting-headline">
        <h2>Product Manager</h2>
        <h3>StartupXYZ</h3>
      </div>
      <div class="posting-description">Seeking a product manager to own roadmap.</div>
    `;
    const result = extractJobFromPage();
    expect(result.source).toBe('Lever');
    expect(result.title).toBe('Product Manager');
    expect(result.company).toBe('StartupXYZ');
    expect(result.description).toBe('Seeking a product manager to own roadmap.');
  });
});

// ── Glassdoor ─────────────────────────────────────────────────────────────────
describe('Glassdoor', () => {
  beforeEach(() => setHostname('www.glassdoor.com'));

  test('extracts with data-test selectors', () => {
    document.body.innerHTML = `
      <span data-test="jobTitle">DevOps Engineer</span>
      <span data-test="employer-name">CloudCo</span>
      <div class="jobDescriptionContent">Build and maintain CI/CD pipelines.</div>
    `;
    const result = extractJobFromPage();
    expect(result.source).toBe('Glassdoor');
    expect(result.title).toBe('DevOps Engineer');
    expect(result.company).toBe('CloudCo');
    expect(result.description).toBe('Build and maintain CI/CD pipelines.');
  });
});

// ── Workday ───────────────────────────────────────────────────────────────────
describe('Workday', () => {
  beforeEach(() => setHostname('careers.myworkdayjobs.com'));

  test('extracts with data-automation-id selectors', () => {
    document.body.innerHTML = `
      <h1 data-automation-id="jobPostingHeader">ML Engineer</h1>
      <span data-automation-id="selectedOrganization">MegaCorp</span>
      <div data-automation-id="job-posting-details">ML engineering role at MegaCorp.</div>
    `;
    const result = extractJobFromPage();
    expect(result.source).toBe('Workday');
    expect(result.title).toBe('ML Engineer');
    expect(result.company).toBe('MegaCorp');
    expect(result.description).toBe('ML engineering role at MegaCorp.');
  });

  test('also matches workday.com hostname', () => {
    setHostname('wd3.myworkday.com');
    document.body.innerHTML = `
      <h1 data-automation-id="jobPostingHeader">SRE</h1>
    `;
    const result = extractJobFromPage();
    expect(result.source).toBe('Workday');
  });
});

// ── Generic fallback ──────────────────────────────────────────────────────────
describe('Generic fallback', () => {
  beforeEach(() => setHostname('careers.somecompany.com'));

  test('uses first h1 as title', () => {
    document.body.innerHTML = `
      <h1>Software Engineer</h1>
      <div class="description">Join our team.</div>
    `;
    const result = extractJobFromPage();
    expect(result.source).toBe('Generic');
    expect(result.title).toBe('Software Engineer');
    expect(result.description).toBe('Join our team.');
  });

  test('falls back to document.title when no h1', () => {
    document.title = 'Senior Developer - Apply Now';
    document.body.innerHTML = '<div>No heading here</div>';
    const result = extractJobFromPage();
    expect(result.source).toBe('Generic');
    expect(result.title).toBe('Senior Developer - Apply Now');
  });
});
