// Shared by the browser tests: starts Chrome (set CHROME to its path on CI) and keeps screenshots out of the repo.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
export const launch = () => puppeteer.launch({
  executablePath: process.env.CHROME || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome"),
  headless: "new", args: process.env.CI ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
});
export const SHOTS = path.join(process.env.SHOTS || tmpdir(), "aceit-shots");
mkdirSync(SHOTS, { recursive: true });
