import dns from "node:dns";
import net from "node:net";

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: BodyInit;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  allowedContentTypes?: string[];
  fetchFn?: typeof fetch;
  dnsLookup?: (hostname: string, options: { all: boolean }) => Promise<Array<{ address: string; family: number }>>;
}

/**
 * Validates whether an IP address belongs to loopback, private RFC1918,
 * link-local/cloud metadata, or other restricted ranges.
 */
export function isBlockedIP(ip: string): boolean {
  let normalized = ip.trim().toLowerCase();

  // Handle IPv6 bracket notation if present
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }

  // Handle IPv4-mapped IPv6 addresses, e.g., ::ffff:127.0.0.1
  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.substring(7);
    if (net.isIPv4(v4Part)) {
      return isBlockedIPv4(v4Part);
    }
  }

  const ipFamily = net.isIP(normalized);
  if (ipFamily === 4) {
    return isBlockedIPv4(normalized);
  } else if (ipFamily === 6) {
    return isBlockedIPv6(normalized);
  }

  // If not recognized as a valid IP address, block out of caution
  return true;
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b, c] = parts;

  // 0.0.0.0/8 (Current network / "this" network)
  if (a === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (RFC1918 Private)
  if (a === 10) return true;

  // 172.16.0.0/12 (RFC1918 Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (RFC1918 Private)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata: AWS, GCP, Azure, OpenStack)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (Carrier-grade NAT: 100.64.0.0 - 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use & 255.255.255.255 Broadcast)
  if (a >= 240) return true;

  return false;
}

function isBlockedIPv6(ip: string): boolean {
  // Loopback ::1
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;

  // Unspecified ::
  if (ip === "::" || ip === "0:0:0:0:0:0:0:0") return true;

  // Link-local unicast (fe80::/10 -> fe80 to febf)
  if (/^fe[89ab][0-9a-f]?::?/i.test(ip)) return true;

  // Unique local address / Private ULA (fc00::/7 -> fc00 to fdff)
  if (/^f[cd][0-9a-f]{2}::?/i.test(ip) || /^f[cd]::/i.test(ip)) return true;

  // Multicast (ff00::/8)
  if (/^ff[0-9a-f]{2}::?/i.test(ip) || /^ff::/i.test(ip)) return true;

  return false;
}

const DEFAULT_ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/json",
  "text/plain",
  "application/xhtml+xml",
  "application/rss+xml",
  "application/xml",
  "text/xml",
  "application/atom+xml",
];

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB hard cutoff
const DEFAULT_MAX_REDIRECTS = 3;

/**
 * SSRF-hardened fetch implementation:
 * - DNS resolution & private/loopback/cloud metadata IP blocking
 * - Strict protocol validation (http/https only)
 * - Manual redirect inspection (up to 3 hops) with destination IP re-verification
 * - Response body streaming with hard 2MB cutoff
 * - Allowed content-type validation
 * - Enforced request timeout
 */
export async function safeFetch(
  targetUrl: string,
  options?: SafeFetchOptions
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowedContentTypes = options?.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;
  const fetchFn = options?.fetchFn ?? fetch;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`SSRF Protection: Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  let currentUrl = targetUrl;
  let redirectCount = 0;
  const visitedUrls = new Set<string>();

  try {
    while (true) {
      if (visitedUrls.has(currentUrl)) {
        throw new Error(`SSRF Protection: Redirect loop detected at ${currentUrl}`);
      }
      visitedUrls.add(currentUrl);

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(currentUrl);
      } catch {
        throw new Error(`SSRF Protection: Malformed URL '${currentUrl}'`);
      }

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error(
          `SSRF Protection: Unsupported protocol '${parsedUrl.protocol}'. Only http and https are allowed.`
        );
      }

      const hostname = parsedUrl.hostname;
      if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal")
      ) {
        throw new Error(`SSRF Protection: Localhost and internal hostnames are blocked (${hostname}).`);
      }

      if (net.isIP(hostname)) {
        if (isBlockedIP(hostname)) {
          throw new Error(`SSRF Protection: Direct IP destination ${hostname} is blocked.`);
        }
      } else {
        const lookupFn = options?.dnsLookup ?? (async (h: string) => {
          return await dns.promises.lookup(h, { all: true });
        });

        const addresses = await lookupFn(hostname, { all: true });
        if (!addresses || addresses.length === 0) {
          throw new Error(`SSRF Protection: Unable to resolve hostname '${hostname}'.`);
        }

        for (const record of addresses) {
          if (isBlockedIP(record.address)) {
            throw new Error(
              `SSRF Protection: Hostname '${hostname}' resolved to blocked IP ${record.address}.`
            );
          }
        }
      }

      const response = await fetchFn(currentUrl, {
        method: options?.method ?? "GET",
        headers: options?.headers,
        body: options?.body,
        signal: controller.signal,
        redirect: "manual",
      });

      // Handle HTTP redirects manually to re-verify destination
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new Error(
            `SSRF Protection: Maximum redirect limit of ${maxRedirects} hops exceeded.`
          );
        }

        const location = response.headers.get("location");
        if (!location) {
          throw new Error(
            `SSRF Protection: Redirect status ${response.status} missing Location header.`
          );
        }

        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      // Check Content-Type for response
      if (response.status !== 204 && response.status !== 304) {
        const contentType = response.headers.get("content-type") || "";
        const lowerContentType = contentType.toLowerCase();
        const isAllowed = allowedContentTypes.some((allowed) =>
          lowerContentType.includes(allowed.toLowerCase())
        );

        if (!isAllowed) {
          throw new Error(
            `SSRF Protection: Disallowed content-type '${contentType}'. Allowed types: ${allowedContentTypes.join(", ")}`
          );
        }
      }

      // Stream body with 2MB cutoff
      if (!response.body) {
        return response;
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > maxBytes) {
        throw new Error(
          `SSRF Protection: Response content-length (${contentLength} bytes) exceeds cutoff of ${maxBytes} bytes.`
        );
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > maxBytes) {
              await reader.cancel();
              throw new Error(
                `SSRF Protection: Response body cutoff reached (${maxBytes} bytes exceeded).`
              );
            }
            chunks.push(value);
          }
        }
      } finally {
        reader.releaseLock?.();
      }

      const buffer = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return new Response(buffer, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
