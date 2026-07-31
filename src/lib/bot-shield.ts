// Bot-/Scraper-Schutz für das Portal.
//
// Ziel: KI-Crawler und Klon-/Scraping-Dienste sollen die Oberfläche nicht
// abziehen können. Reguläre Suchmaschinen (Google, Bing) bleiben erlaubt,
// damit öffentliche Bewerbungsseiten weiterhin gefunden werden.

/** Bekannte KI-/Trainings-/Scraping-Crawler (Kleinbuchstaben-Match im User-Agent). */
const BLOCKED_AGENTS = [
  "gptbot", "oai-searchbot", "chatgpt-user", "claudebot", "claude-web",
  "anthropic-ai", "perplexitybot", "perplexity-user", "google-extended",
  "applebot-extended", "bytespider", "ccbot", "diffbot", "facebookbot",
  "meta-externalagent", "amazonbot", "cohere-ai", "timpibot", "omgilibot",
  "imagesiftbot", "youbot", "ai2bot", "firecrawl", "scrapy", "httrack",
  "libwww-perl", "phantomjs", "webcopier", "webzip", "teleport", "sitesucker",
  "heritrix", "nutch", "zgrab", "masscan",
];

/** Eigene Tools (curl, Deploy-Skripte, Health-Checks) bleiben absichtlich erlaubt. */
export function isBlockedAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").toLowerCase().trim();
  if (!ua) return false;
  return BLOCKED_AGENTS.some((needle) => ua.includes(needle));
}

/** Öffentliche Endpunkte, die Maschinen erreichen dürfen (Webhooks, Cron, Health). */
function isMachineAllowedPath(pathname: string): boolean {
  return pathname.startsWith("/api/public/") || pathname === "/robots.txt";
}

/**
 * Liefert eine 403-Antwort, wenn der Request von einem bekannten
 * Scraper/KI-Crawler kommt — sonst `null`.
 */
export function botShieldResponse(request: Request): Response | null {
  let pathname = "/";
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    /* ignore */
  }
  if (isMachineAllowedPath(pathname)) return null;
  if (!isBlockedAgent(request.headers.get("user-agent"))) return null;

  return new Response(
    "403 – Automatisierter Zugriff auf diese Anwendung ist nicht gestattet.",
    {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex, nofollow, noarchive, nosnippet, noai, noimageai",
        "cache-control": "no-store",
      },
    },
  );
}

/** Schutz-Header für jede ausgelieferte Seite. */
export function applyAntiScrapeHeaders(response: Response, request: Request): Response {
  let pathname = "/";
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    /* ignore */
  }
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noai, noimageai");
  // Interner Bereich zusätzlich komplett aus dem Index halten.
  if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard")) {
    headers.set("x-robots-tag", "noindex, nofollow, noarchive, nosnippet, noai, noimageai");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
