/**
 * Landing-Agent — meldet den Server minütlich beim Portal.
 *
 * Sendet POST an <PORTAL_BASE>/api/public/landing-server-heartbeat mit
 *   { token, agent_version, renderer_healthy, resync_done }
 * Antwort enthält { resync_needed }. Ist das true, werden die Themes neu
 * synchronisiert (Repo-Pull + Renderer-Neustart) und beim nächsten Ping
 * resync_done gemeldet.
 *
 * Pflicht-ENV:
 *   LANDING_SERVER_TOKEN   Bootstrap-Token aus /admin/infrastructure
 *   PORTAL_API_ENDPOINT    z.B. https://mb-portal.com/api/public/applications
 *                          (oder direkt PORTAL_BASE=https://mb-portal.com)
 * Optional:
 *   PORT                   Port des Renderers (Default 3001)
 *   HEARTBEAT_INTERVAL_MS  Default 60000
 *   PROJECT_DIR            Default /opt/apps/landing-server
 *   REPO_URL / REPO_BRANCH für Theme-Resync
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

const AGENT_VERSION = "1.0.0";

const TOKEN = (process.env.LANDING_SERVER_TOKEN || "").trim();
const PORTAL_BASE = (
  process.env.PORTAL_BASE ||
  (process.env.PORTAL_API_ENDPOINT || "").replace(/\/api\/public\/.*$/, "")
).replace(/\/+$/, "");
const RENDERER_PORT = Number(process.env.PORT || 3001);
const INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 60_000);
const PROJECT_DIR = process.env.PROJECT_DIR || "/opt/apps/landing-server";
const REPO_URL = process.env.REPO_URL || "";
const REPO_BRANCH = process.env.REPO_BRANCH || "main";

if (!TOKEN) {
  console.error("[agent] LANDING_SERVER_TOKEN fehlt — Agent beendet sich.");
  process.exit(1);
}
if (!PORTAL_BASE) {
  console.error("[agent] PORTAL_BASE/PORTAL_API_ENDPOINT fehlt — Agent beendet sich.");
  process.exit(1);
}

const HEARTBEAT_URL = `${PORTAL_BASE}/api/public/landing-server-heartbeat`;

let resyncDonePending = false;
let resyncRunning = false;

function sh(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 180_000, ...opts }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ""), stderr: String(stderr || err?.message || "") });
    });
  });
}

async function checkRenderer() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`http://127.0.0.1:${RENDERER_PORT}/_health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function resyncThemes() {
  if (resyncRunning) return;
  resyncRunning = true;
  console.log("[agent] Theme-Resync gestartet");
  try {
    const repoDir = `${PROJECT_DIR}.repo`;
    if (REPO_URL) {
      if (existsSync(`${repoDir}/.git`)) {
        await sh("git", ["-C", repoDir, "fetch", "origin", REPO_BRANCH]);
        await sh("git", ["-C", repoDir, "reset", "--hard", `origin/${REPO_BRANCH}`]);
      } else {
        await sh("git", ["clone", "--branch", REPO_BRANCH, REPO_URL, repoDir]);
      }
      if (existsSync(`${repoDir}/src/landing-themes`)) {
        await sh("rm", ["-rf", `${PROJECT_DIR}/themes`]);
        await sh("cp", ["-a", `${repoDir}/src/landing-themes`, `${PROJECT_DIR}/themes`]);
      }
    }
    await sh("systemctl", ["restart", "landing.service"]);
    resyncDonePending = true;
    console.log("[agent] Theme-Resync abgeschlossen");
  } catch (e) {
    console.error("[agent] Theme-Resync fehlgeschlagen:", e?.message || e);
  } finally {
    resyncRunning = false;
  }
}

async function beat() {
  const healthy = await checkRenderer();
  const payload = {
    token: TOKEN,
    agent_version: AGENT_VERSION,
    renderer_healthy: healthy,
  };
  if (resyncDonePending) payload.resync_done = true;

  try {
    const res = await fetch(HEARTBEAT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok !== true) {
      console.error(`[agent] Heartbeat abgelehnt (${res.status}):`, json?.error || "unbekannt");
      return;
    }
    if (resyncDonePending) resyncDonePending = false;
    if (json.resync_needed) void resyncThemes();
  } catch (e) {
    console.error("[agent] Heartbeat fehlgeschlagen:", e?.message || e);
  }
}

console.log(`[agent] v${AGENT_VERSION} → ${HEARTBEAT_URL} alle ${Math.round(INTERVAL_MS / 1000)}s`);
void beat();
setInterval(() => void beat(), INTERVAL_MS);
