// End-to-end checks against the production build, driven by real Chrome at 1366×768.
// Usage: npm run build && npm run e2e
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4173;
// E2E_URL=https://parammadan.github.io/tiya-cat2026/ runs the suite against the live site instead of a local preview.
const LIVE = process.env.E2E_URL || '';
const BASE = LIVE || `http://localhost:${PORT}/tiya-cat2026/`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

let server = null;
if (!LIVE) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview server did not start')), 20000);
    server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
  });
}
console.log(`Testing ${BASE}`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const badResponses = [];
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', (r) => badResponses.push(`FAILED ${r.url()}`));
const assetUrls = new Set();
page.on('response', (r) => { if (/\/assets\//.test(r.url())) assetUrls.add(`${r.status()} ${r.url().split('/').pop()}`); });

const tileClass = (n) => page.locator('.palette-grid .tile').nth(n - 1).getAttribute('class');
const fits = async () => page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
async function begin(mockId) {
  await page.goto(`${BASE}#/mock/${mockId}`);
  await page.getByRole('button', { name: 'Continue to Instructions' }).click();
  const btn = page.getByRole('button', { name: 'I Am Ready to Begin' });
  const disabledFirst = await btn.isDisabled();
  await page.locator('.agree input').check();
  await btn.click();
  await page.waitForSelector('[data-testid="timer"]');
  return disabledFirst;
}
async function submitNow() {
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, submit' }).click();
  await page.waitForSelector('[data-testid="score"]');
}
async function setDeadline(offsetMs) {
  await page.evaluate((off) => {
    const k = 'tiya-cat2026.v1'; const s = JSON.parse(localStorage.getItem(k));
    const a = s.attempts.find((x) => x.submittedAt === null); a.deadline = Date.now() + off; localStorage.setItem(k, JSON.stringify(s));
  }, offsetMs);
}

try {
  // 1. Dashboard
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  check('Dashboard title', (await page.title()) === 'TIYA MADAN | CAT 2026');
  check('Dashboard lists five mocks', (await page.locator('.mock-card').count()) === 5);
  const dashText = await page.locator('body').innerText();
  check('No mock design labels visible to the candidate', !/Baseline|CAT 2020 reasoning|Advanced inference|Abstract RC and difficult VA|Exam-day simulation/i.test(dashText));
  check('Subtitle shown', (await page.locator('.brand-sub').innerText()).includes('VARC Examination Centre'));
  const hero = await page.locator('.candidate-hero').textContent();
  check('Dashboard shows candidate name, aspiration and motto', hero.includes('Tiya Madan') && hero.includes('Aspiring IIM Ahmedabad Student | CAT 2026') && hero.includes('Every question you solve brings you one step closer to the dream.'));
  await page.screenshot({ path: SHOTS + '01-dashboard.png' });
  let f = await fits(); check('Dashboard: no horizontal scroll at 1366', f.w <= f.iw, JSON.stringify(f));

  // 2. Pre-test screens + detailed Mock 1 flow
  await page.goto(`${BASE}#/mock/1`);
  const info = await page.locator('.info-table').innerText();
  check('Pre-test details', ['Tiya Madan', 'CAT 2026 — VARC Practice', '40 minutes', '24', '72'].every((s) => info.includes(s)));
  const disabledFirst = await begin(1);
  check('"I Am Ready to Begin" disabled until acknowledged', disabledFirst);
  const t0 = await page.locator('[data-testid="timer"]').innerText();
  check('Timer starts at 40:00', t0 === '40:00' || t0.startsWith('39:5'), t0);
  check('Palette shows 24 questions', (await page.locator('.palette-grid .tile').count()) === 24);
  await page.screenshot({ path: SHOTS + '02-exam-mock1-rc.png' });
  f = await fits(); check('Exam fits 1366×768 without page scroll', f.w <= f.iw && f.h <= f.ih, JSON.stringify(f));
  check('Passage panel scrolls independently', await page.locator('.pane.left').evaluate((el) => getComputedStyle(el).overflowY === 'auto'));
  check('No answer/explanation visible during test', (await page.locator('.explanation, .opt-correct').count()) === 0);
  check('Motivational text never shown during the timed test', !(await page.locator('body').innerText()).includes('closer to the dream') && !(await page.locator('body').innerText()).includes('Aspiring IIM'));

  await page.locator('label.option', { hasText: '(C)' }).click();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  check('Save & Next → Q1 Answered (green)', (await tileClass(1)).includes('tile-answered'));
  check('Moved to Q2', (await page.locator('.q-no').innerText()) === 'Question 2');
  await page.locator('label.option', { hasText: '(A)' }).click();
  await page.locator('.palette-grid .tile').nth(4).click();
  check('Unsaved selection discarded on navigation → Q2 Not Answered (red)', (await tileClass(2)).includes('tile-notAnswered'));
  check('Unvisited question stays Not Visited', (await tileClass(10)).includes('tile-notVisited'));
  await page.locator('.palette-grid .tile').nth(1).click();
  await page.locator('label.option', { hasText: '(A)' }).click();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await page.getByRole('button', { name: 'Mark for Review & Next' }).click();
  check('Mark for Review without answer → Q3 Marked (purple)', (await tileClass(3)).includes('tile-marked'));
  await page.locator('.palette-grid .tile').nth(16).click();
  check('Q17 is TITA with numeric input', (await page.locator('.tita-input').count()) === 1);
  await page.screenshot({ path: SHOTS + '03-exam-mock1-tita.png' });
  await page.locator('.keypad button', { hasText: /^2$/ }).click();
  await page.locator('.tita-input').pressSequentially('1439');
  check('TITA input limited to 4 digits', (await page.locator('.tita-input').inputValue()) === '2143');
  await page.getByRole('button', { name: 'Mark for Review & Next' }).click();
  check('Answered + marked → Q17 Answered & Marked', (await tileClass(17)).includes('tile-answeredMarked'));
  await page.locator('.palette-grid .tile').nth(20).click();
  await page.locator('label.option', { hasText: '(B)' }).click();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await page.locator('.palette-grid .tile').nth(20).click();
  await page.getByRole('button', { name: 'Clear Response' }).click();
  check('Clear Response → Q21 Not Answered', (await tileClass(21)).includes('tile-notAnswered'));
  await page.locator('label.option', { hasText: '(B)' }).click();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await page.locator('.palette-grid .tile').nth(23).click();
  await page.getByRole('button', { name: 'Previous' }).click();
  check('Previous button navigates back', (await page.locator('.q-no').innerText()) === 'Question 23');

  // Refresh persistence
  await page.waitForTimeout(2200);
  const before = await page.locator('[data-testid="timer"]').innerText();
  await page.reload();
  await page.waitForSelector('[data-testid="timer"]');
  const after = await page.locator('[data-testid="timer"]').innerText();
  const secs = (s) => { const [m, x] = s.split(':').map(Number); return m * 60 + x; };
  check('Refresh does not reset the timer', secs(after) <= secs(before) && after !== '40:00', `${before} → ${after}`);
  check('Refresh keeps answers and statuses', (await tileClass(1)).includes('tile-answered') && (await tileClass(17)).includes('tile-answeredMarked') && (await tileClass(3)).includes('tile-marked'));
  check('Refresh keeps the current question', (await page.locator('.q-no').innerText()) === 'Question 23');

  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const modal = await page.locator('.modal').innerText();
  check('Submit shows exam summary', modal.includes('Answered') && modal.includes('Not Visited'));
  await page.getByRole('button', { name: 'Yes, submit' }).click();
  await page.waitForSelector('[data-testid="score"]');
  const score = await page.locator('[data-testid="score"]').innerText();
  check('Score = 8 (C +3, A on Q2 −1, TITA 2143 +3 [answered & marked counts], Q21 B +3)', score === '8', `score ${score}`);
  const stats = await page.locator('.stat-grid').innerText();
  check('Result counts: 3 correct, 1 incorrect, 20 unattempted', /3\s*Correct/i.test(stats) && /1\s*Incorrect/i.test(stats) && /20\s*Unattempted/i.test(stats), stats.replace(/\n/g, ' | '));
  check('RC/VA split: RC 2/48, VA 6/24', stats.includes('2 / 48') && stats.includes('6 / 24'));
  check('No percentile or rank shown', !(await page.locator('main').innerText()).match(/percentile:|rank:/i));
  await page.screenshot({ path: SHOTS + '04-result.png', fullPage: true });
  f = await fits(); check('Result: no horizontal scroll', f.w <= f.iw);
  const resultUrl = page.url();
  const attemptId = resultUrl.split('/').pop();

  // Browser back/forward navigation
  await page.goto(`${BASE}#/review/${attemptId}`);
  await page.waitForSelector('.explanation');
  await page.goBack();
  await page.waitForSelector('[data-testid="score"]');
  check('Browser Back returns from review to result', page.url().includes('#/result/'));
  await page.goForward();
  await page.waitForSelector('.explanation');
  check('Browser Forward returns to review', page.url().includes('#/review/'));

  // Editing after submission blocked
  await page.goto(`${BASE}#/exam/${attemptId}`);
  await page.waitForTimeout(400);
  check('Submitted attempt cannot be reopened for editing', page.url().includes('#/result/'));

  // Review
  await page.goto(`${BASE}#/review/${attemptId}`);
  await page.waitForSelector('.explanation');
  check('Review shows explanation with source content', (await page.locator('.explanation').first().innerText()).length > 200);
  await page.getByRole('tab', { name: /Incorrect/ }).click();
  check('Incorrect filter lists exactly Q2', (await page.locator('.review-qnav .qchip').allInnerTexts()).join(',') === '2');
  check('Review marks correct option and wrong response', (await page.locator('.opt-correct').count()) === 1 && (await page.locator('.opt-wrong').count()) === 1);
  await page.getByRole('tab', { name: /Marked for review/ }).click();
  check('Marked filter lists Q3 and Q17', (await page.locator('.review-qnav .qchip').allInnerTexts()).join(',') === '3,17');
  await page.getByRole('tab', { name: /Unattempted/ }).click();
  check('Unattempted filter lists 20 questions', (await page.locator('.review-qnav .qchip').count()) === 20);
  check('Review is read-only', await page.locator('.option input').first().isDisabled());
  await page.getByRole('tab', { name: /All questions/ }).click();
  await page.screenshot({ path: SHOTS + '05-review.png' });
  f = await fits(); check('Review fits 1366 width', f.w <= f.iw);

  // 3. Every mock starts; Mock 5 interleaving
  for (const m of [2, 3, 4, 5]) {
    await begin(m);
    const ok = (await page.locator('.palette-grid .tile').count()) === 24 && (await page.locator('.q-no').innerText()) === 'Question 1';
    check(`Mock ${m} starts with 24 questions`, ok);
    if (m === 5) {
      check('Mock 5 Q1 is a VA summary (interleaved)', (await page.locator('.panel-label').innerText()).includes('Para Summary'));
      await page.locator('.palette-grid .tile').nth(2).click();
      check('Mock 5 Q3 shows Passage 1', (await page.locator('.panel-label').innerText()).includes('Passage 1'));
      await page.locator('.palette-grid .tile').nth(6).click();
      check('Mock 5 Q7 is odd-one-out TITA', (await page.locator('.tita-input').count()) === 1 && (await page.locator('.panel-label').innerText()).includes('Odd Sentence Out'));
      await page.locator('.palette-grid .tile').nth(12).click();
      check('Mock 5 Q13 is sentence placement with gaps', (await page.locator('.gap').count()) === 4);
      await page.screenshot({ path: SHOTS + '06-exam-mock5-placement.png' });
      await page.locator('.palette-grid .tile').nth(18).click();
      check('Mock 5 Q19 shows Passage 4', (await page.locator('.panel-label').innerText()).includes('Passage 4'));
      await submitNow();
    }
    if (m === 2) {
      // Expiry while away: deadline already passed when the candidate returns
      await setDeadline(-1000);
      await page.reload();
      await page.waitForSelector('[data-testid="score"]', { timeout: 8000 });
      check('Return after deadline → attempt auto-submitted and result shown', (await page.locator('main').innerText()).includes('submitted automatically'));
    }
    if (m === 3) {
      // Live expiry while the exam is open
      await setDeadline(3000);
      await page.reload();
      await page.waitForSelector('[data-testid="timer"]');
      await page.waitForURL(/#\/result\//, { timeout: 9000 });
      check('Timer reaching 00:00 auto-submits the open test', page.url().includes('#/result/'));
    }
    if (m === 4) {
      await setDeadline(120000);
      await page.reload();
      await page.waitForSelector('.warn-strip');
      check('Last-five-minute warning shown (restrained strip + red timer)', (await page.locator('.timer-warn').count()) === 1);
      await page.screenshot({ path: SHOTS + '07-exam-warning.png' });
      await submitNow();
    }
  }

  // 4. Reattempt creates a separate record
  await begin(1);
  await submitNow();
  await page.goto(BASE);
  const m1History = await page.locator('.mock-card').first().locator('.mini-history tbody tr').count();
  check('Reattempt stored as a separate record (Mock 1 has 2 attempts)', m1History === 2);

  // 5. Performance page
  await page.goto(`${BASE}#/progress`);
  await page.waitForSelector('.graph svg');
  check('Performance graph rendered', (await page.locator('.graph circle').count()) === 6);
  check('All attempts table lists 6 attempts', (await page.locator('table').last().locator('tbody tr').count()) === 6);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export attempt history/ }).click()]);
  check('Export produces a JSON download', download.suggestedFilename().endsWith('.json'));
  await page.screenshot({ path: SHOTS + '08-performance.png', fullPage: true });
  f = await fits(); check('Performance: no horizontal scroll', f.w <= f.iw);

  check('No console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('All requests succeeded (no 4xx/5xx or failed loads)', badResponses.length === 0, badResponses.slice(0, 5).join(' | '));
  check('JS and CSS assets loaded from the deployed base path', [...assetUrls].some((u) => u.startsWith('200') && u.endsWith('.js')) && [...assetUrls].some((u) => u.startsWith('200') && u.endsWith('.css')), [...assetUrls].join(', '));
} catch (e) {
  check('E2E run completed without exceptions', false, String(e));
} finally {
  await browser.close();
  if (server) server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
