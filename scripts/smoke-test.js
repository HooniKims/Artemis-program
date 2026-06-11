import { chromium } from "playwright";

const URL = process.env.SMOKE_URL ?? "http://localhost:5173/";

async function countCanvasPixels(page) {
  return page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector("#mission-canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const pixels = new Uint8Array(4);
    let nonBlack = 0;
    let total = 0;
    for (let ix = 1; ix <= 18; ix += 1) {
      for (let iy = 1; iy <= 28; iy += 1) {
        const x = Math.floor((canvas.width * ix) / 19);
        const y = Math.floor((canvas.height * iy) / 29);
        gl.readPixels(x, canvas.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (pixels[3] > 0 && pixels[0] + pixels[1] + pixels[2] > 15) nonBlack += 1;
        total += 1;
      }
    }
    return { nonBlack, total };
  });
}

async function runViewport(browser, viewport) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelector("#loading-screen")?.classList.contains("hidden"),
    null,
    { timeout: 15_000 },
  );

  const eventCount = await page.locator("#event-list button").count();
  if (eventCount !== 14) {
    throw new Error(`${viewport.name}: expected 14 mission events, got ${eventCount}`);
  }

  await page.click('button[data-view="moon"]');
  await page.getByText("달 최근접", { exact: true }).click();
  await page.waitForTimeout(700);

  const status = await page.evaluate(() => ({
    stage: document.querySelector("#stage-pill")?.textContent,
    title: document.querySelector("#brief-title")?.textContent,
    signal: document.querySelector("#signal-pill")?.textContent,
    moonDistance: document.querySelector("#moon-distance")?.textContent,
    primaryBottom: document.querySelector(".hud-primary").getBoundingClientRect().bottom,
    panelTop: document.querySelector(".hud-panel").getBoundingClientRect().top,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    numericStyle: getComputedStyle(document.querySelector("#earth-distance")).fontVariantNumeric,
    numericFeatures: getComputedStyle(document.querySelector("#earth-distance")).fontFeatureSettings,
    speedSelectColor: getComputedStyle(document.querySelector("#speed-select")).color,
    speedSelectFill: getComputedStyle(document.querySelector("#speed-select")).webkitTextFillColor,
  }));

  if (status.stage !== "Closest approach") throw new Error(`${viewport.name}: wrong stage`);
  if (status.title !== "달 최근접") throw new Error(`${viewport.name}: wrong event title`);
  if (status.signal !== "BLACKOUT") throw new Error(`${viewport.name}: blackout cue missing`);
  if (!status.moonDistance?.includes("8,292")) {
    throw new Error(`${viewport.name}: unexpected moon distance ${status.moonDistance}`);
  }
  if (status.overflowX) throw new Error(`${viewport.name}: horizontal overflow`);
  if (!status.numericStyle.includes("tabular-nums") && !status.numericFeatures.includes("tnum")) {
    throw new Error(`${viewport.name}: telemetry numerals are not fixed width`);
  }
  if (status.speedSelectColor === "rgb(255, 255, 255)" || status.speedSelectFill === "rgb(255, 255, 255)") {
    throw new Error(`${viewport.name}: speed selector text is white`);
  }
  if (viewport.name === "mobile" && status.primaryBottom > status.panelTop) {
    throw new Error(`${viewport.name}: HUD panels overlap`);
  }

  const pixels = await countCanvasPixels(page);
  if (pixels.nonBlack < 20) {
    throw new Error(`${viewport.name}: canvas appears blank (${pixels.nonBlack}/${pixels.total})`);
  }

  await page.click('button[data-view="window"]');
  await page.waitForTimeout(300);
  const windowOverlay = await page.evaluate(() =>
    document.querySelector("#cockpit-overlay")?.classList.contains("visible"),
  );
  if (!windowOverlay) throw new Error(`${viewport.name}: window overlay did not activate`);

  const canvasBox = await page.locator("#mission-canvas").boundingBox();
  await page.mouse.dblclick(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.waitForTimeout(250);
  const freeViewActive = await page.evaluate(() =>
    document.querySelector('button[data-view="free"]')?.classList.contains("active"),
  );
  if (!freeViewActive) throw new Error(`${viewport.name}: double-click did not enter free zoom view`);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(100);

  if (pageErrors.length) throw new Error(`${viewport.name}: page errors: ${pageErrors.join("; ")}`);

  await page.close();
  return { viewport: viewport.name, pixels, status };
}

const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  for (const viewport of [
    { name: "desktop", width: 1440, height: 960 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    results.push(await runViewport(browser, viewport));
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
