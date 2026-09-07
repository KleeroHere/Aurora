// Acceptance check: drive the running app the way a visitor would.
//
// Unit tests answer "does this function behave". This answers "does a person
// who opens the link actually get what we think they get". Both have caught
// things the other missed, and this one exists because a green test suite over
// a broken screen has happened here before.
//
//   npm run dev                  # in one terminal
//   node scripts/verify_ui.mjs   # in another
//
// LITE_URL overrides the address (default http://localhost:1420/).
// Screenshots land in ./ui-shots so a failure can be looked at, not guessed at.
//
// Exit code 0 when every check passes, 1 otherwise.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.LITE_URL ?? "http://localhost:1420/";
const SHOTS = "ui-shots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("  [page error] " + e.message));

async function signIn(login) {
  await page.goto(URL, { waitUntil: "networkidle" });
  // The splash screen is skipped by a click, exactly as a person skips it.
  await page.mouse.click(720, 450);
  await page.waitForTimeout(1200);
  await page.locator("select").first().selectOption(login, { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.locator('input[type="password"]').fill("aurora");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(2500);
  // The demo accounts still carry their shipped password, so the app offers to
  // change it. A visitor walks past that screen; so do we.
  const later = page.getByRole("button", { name: /dismiss and continue/i });
  if (await later.count()) {
    await later.click();
    await page.waitForTimeout(2500);
  }
  // The first-run guided tour starts on its own a moment after the app opens,
  // and it walks the viewer to the screen it is explaining — which means it
  // navigates. Close it before doing anything, or it competes for the route.
  // (This is why the production build failed a check the dev server passed:
  // the tour got there first, the slower dev build did not.)
  const scrim = page.locator(".help-overlay__scrim").first();
  await scrim.waitFor({ timeout: 6000 }).catch(() => {});
  if (await scrim.count()) {
    // Escape is what closes it; a click on the scrim is swallowed by the
    // highlighted element underneath.
    await page.keyboard.press("Escape");
    await scrim.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

// --- 1. Alex has training assigned and must meet the induction course --------
await signIn("Alex");
await page.waitForTimeout(3000);
const courseTitle = await page.locator("h1.training__title").count();
check("signing in as Alex leads to the induction course", courseTitle > 0);

if (courseTitle > 0) {
  const heading = await page.locator("h1.training__title").innerText();
  const subtitle = await page.locator(".training__subtitle").innerText();
  check("the course is addressed to the person by name", /Alex/.test(subtitle), subtitle.slice(0, 70));
  check("the course heading reads as expected", /Induction/i.test(heading), heading);
  const article = await page.locator(".training__article-title").innerText().catch(() => "");
  check("the first page of the course opened", article.length > 0, article);
  await page.screenshot({ path: SHOTS + "/01-course.png" });

  const next = page.locator(".training__button--primary");
  check("there is a button to move on", (await next.count()) > 0, await next.innerText().catch(() => ""));

  // Walk every page of the course through to the test.
  for (let i = 0; i < 6; i++) {
    await page.locator(".training__body").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(400);
    const label = await next.innerText().catch(() => "");
    await next.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
    if (/test/i.test(label)) break;
  }
  const questions = await page.locator(".training__question").count();
  check("after the last page the test opens", questions === 3, `questions: ${questions}`);
  await page.screenshot({ path: SHOTS + "/02-quiz.png", fullPage: true });

  if (questions === 3) {
    // Answer the first option to every question: some are wrong on purpose.
    // The bar is 100 %, so this must not let anybody through.
    for (const group of await page.locator(".training__question").all()) {
      await group.locator("input[type=radio]").first().check();
    }
    await page.locator(".training__button--primary").click();
    await page.waitForTimeout(1200);
    const body = await page.locator(".training__body").innerText();
    const failed = /correct/i.test(body) && !/All correct/i.test(body);
    check("a test with mistakes does not let you through (the bar is 100 %)", failed, body.split("\n")[0]);
    await page.screenshot({ path: SHOTS + "/03-failed.png" });
  }
}

// --- 2. Robin has no training assigned and goes straight to the handbook -----
await signIn("Robin");
await page.waitForTimeout(2500);
const sidebar = await page.locator(".sidebar").count();
const courseForRobin = await page.locator("h1.training__title").count();
check("Robin lands in the handbook, with no course", sidebar > 0 && courseForRobin === 0);
const badge = await page.locator(".training-badge").count();
check("Robin has no training badge — it was never assigned", badge === 0);
await page.screenshot({ path: SHOTS + "/04-robin-home.png" });

// --- 3. The programme page renders its blocks --------------------------------
// Navigate inside the app rather than reloading it. The startup gate wraps the
// whole page tree, so any cold load lands on the sign-in screen no matter what
// the address says — that is deliberate, and it means a deep link only works
// once somebody is already signed in.
await page.evaluate(() => {
  window.location.hash = "#/training";
});
const programme = page.locator(".training-program__title");
// Wait for the element rather than a fixed pause: the live demo seeds its
// database on first load and is slower than the dev server.
await programme.waitFor({ timeout: 20000 }).catch(() => {});
const programTitle = await programme.count();
check("the training programme opens for somebody already signed in", programTitle > 0);
if (programTitle > 0) {
  // The cards arrive after their sections are read, so wait for one of them —
  // the heading renders long before the blocks do.
  await page.locator(".training-card").first().waitFor({ timeout: 20000 }).catch(() => {});
  const cards = await page.locator(".training-card").count();
  check("the page shows seven blocks", cards === 7, `cards: ${cards}`);
  const counters = await page.locator(".training-card__counter").allInnerTexts();
  // `every` on an empty list is true, so the count is asserted too — otherwise
  // this passes cheerfully when nothing rendered at all.
  const allCounted = counters.length === 7 && counters.every((t) => /of \d+/.test(t));
  check("every block knows how many materials it holds", allCounted, counters[0] ?? "nothing rendered");
  await page.screenshot({ path: SHOTS + "/05-program.png", fullPage: true });
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
console.log(`Screenshots: ${SHOTS}/`);
process.exit(failed.length ? 1 : 0);
