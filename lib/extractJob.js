// Self-contained — no imports. This function is serialized and injected into
// the active tab via chrome.scripting.executeScript, so it must not reference
// anything from outer scope. Keep it that way.
export function extractJobFromPage() {
  function getText(...selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        // textContent works in all environments (jsdom + real browser); innerText
        // requires CSS layout which jsdom cannot compute.
        if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
      } catch (_) {
        // ignore invalid selectors
      }
    }
    return '';
  }

  const host = window.location.hostname;

  if (host.includes('linkedin.com')) {
    return {
      title:       getText('h1.t-24', '.job-details-jobs-unified-top-card__job-title h1'),
      company:     getText('.job-details-jobs-unified-top-card__company-name a'),
      description: getText('.jobs-description-content__text', '.jobs-description__content'),
      source:      'LinkedIn',
    };
  }
  if (host.includes('indeed.com')) {
    return {
      title:       getText('h1[data-testid="jobsearch-JobInfoHeader-title"]', 'h1.jobsearch-JobInfoHeader-title'),
      company:     getText('[data-company-name]', '.jobsearch-CompanyInfoWithoutHeaderImage a'),
      description: getText('#jobDescriptionText'),
      source:      'Indeed',
    };
  }
  if (host.includes('greenhouse.io')) {
    return {
      title:       getText('h1.app-title', '.job-post h1', 'h1'),
      company:     getText('.company-name') ||
                   (document.title.includes(' at ')
                     ? document.title.split(' at ').slice(1).join(' at ').trim()
                     : ''),
      description: getText('#content', '.section-wrapper'),
      source:      'Greenhouse',
    };
  }
  if (host.includes('lever.co')) {
    return {
      title:       getText('.posting-headline h2', 'h2'),
      company:     getText('.posting-headline h3', '.posting-category'),
      description: getText('.posting-description', '[class*="content-wrapper"]'),
      source:      'Lever',
    };
  }
  if (host.includes('glassdoor.com')) {
    return {
      title:       getText('[data-test="jobTitle"]'),
      company:     getText('[data-test="employer-name"]'),
      description: getText('[class*="jobDescriptionContent"]', '[class*="JobDetails_jobDescription"]'),
      source:      'Glassdoor',
    };
  }
  if (host.includes('workday.com') || host.includes('myworkdayjobs.com')) {
    return {
      title:       getText('[data-automation-id="jobPostingHeader"]'),
      company:     getText('[data-automation-id="selectedOrganization"]'),
      description: getText('[data-automation-id="job-posting-details"]'),
      source:      'Workday',
    };
  }

  // Generic fallback
  return {
    title:       document.querySelector('h1')?.textContent?.trim() || document.title,
    company:     '',
    description: document.querySelector('[class*="description"], [id*="description"]')?.textContent?.trim() || '',
    source:      'Generic',
  };
}
