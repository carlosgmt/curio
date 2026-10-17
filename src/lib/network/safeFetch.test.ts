import { describe, expect, it } from "bun:test";
import { isBlockedIP, safeFetch } from "./safeFetch";

describe("Network Fetching & SSRF Hardening", () => {
  describe("IP Address Validation (isBlockedIP)", () => {
    it("blocks IPv4 loopback addresses (127.0.0.0/8)", () => {
      expect(isBlockedIP("127.0.0.1")).toBe(true);
      expect(isBlockedIP("127.0.0.2")).toBe(true);
      expect(isBlockedIP("127.255.255.255")).toBe(true);
    });

    it("blocks RFC1918 private IPv4 addresses", () => {
      // 10.0.0.0/8
      expect(isBlockedIP("10.0.0.1")).toBe(true);
      expect(isBlockedIP("10.254.254.254")).toBe(true);

      // 172.16.0.0/12
      expect(isBlockedIP("172.16.0.1")).toBe(true);
      expect(isBlockedIP("172.31.255.255")).toBe(true);
      expect(isBlockedIP("172.32.0.1")).toBe(false); // Public range

      // 192.168.0.0/16
      expect(isBlockedIP("192.168.0.1")).toBe(true);
      expect(isBlockedIP("192.168.255.255")).toBe(true);
    });

    it("blocks link-local and cloud metadata addresses (169.254.0.0/16)", () => {
      expect(isBlockedIP("169.254.169.254")).toBe(true);
      expect(isBlockedIP("169.254.1.1")).toBe(true);
    });

    it("blocks 0.0.0.0/8 and broadcast/multicast", () => {
      expect(isBlockedIP("0.0.0.0")).toBe(true);
      expect(isBlockedIP("224.0.0.1")).toBe(true);
      expect(isBlockedIP("255.255.255.255")).toBe(true);
    });

    it("blocks IPv6 loopback, link-local, and ULA", () => {
      expect(isBlockedIP("::1")).toBe(true);
      expect(isBlockedIP("::")).toBe(true);
      expect(isBlockedIP("fe80::1")).toBe(true);
      expect(isBlockedIP("fc00::1")).toBe(true);
      expect(isBlockedIP("fd12:3456:789a::1")).toBe(true);
    });

    it("blocks IPv4-mapped IPv6 addresses", () => {
      expect(isBlockedIP("::ffff:127.0.0.1")).toBe(true);
      expect(isBlockedIP("::ffff:169.254.169.254")).toBe(true);
      expect(isBlockedIP("::ffff:10.0.0.1")).toBe(true);
      expect(isBlockedIP("::ffff:8.8.8.8")).toBe(false);
    });

    it("allows valid public IP addresses", () => {
      expect(isBlockedIP("8.8.8.8")).toBe(false);
      expect(isBlockedIP("1.1.1.1")).toBe(false);
      expect(isBlockedIP("93.184.216.34")).toBe(false);
    });
  });

  describe("safeFetch URL & Protocol Enforcement", () => {
    it("rejects non-HTTP protocols", async () => {
      await expect(safeFetch("file:///etc/passwd")).rejects.toThrow("Unsupported protocol");
      await expect(safeFetch("ftp://example.com/file")).rejects.toThrow("Unsupported protocol");
      await expect(safeFetch("gopher://example.com")).rejects.toThrow("Unsupported protocol");
    });

    it("rejects localhost and internal hostname targets", async () => {
      await expect(safeFetch("http://localhost:3000/api")).rejects.toThrow("blocked");
      await expect(safeFetch("http://app.localhost:8080")).rejects.toThrow("blocked");
      await expect(safeFetch("http://backend.internal/data")).rejects.toThrow("blocked");
    });

    it("rejects direct private and loopback IP targets", async () => {
      await expect(safeFetch("http://127.0.0.1:8000/secret")).rejects.toThrow("blocked");
      await expect(safeFetch("http://169.254.169.254/latest/meta-data")).rejects.toThrow("blocked");
      await expect(safeFetch("http://192.168.1.1/admin")).rejects.toThrow("blocked");
      await expect(safeFetch("http://10.0.0.5/api")).rejects.toThrow("blocked");
    });

    it("rejects domains resolving to private/loopback IPs", async () => {
      const mockDns = async () => [{ address: "127.0.0.1", family: 4 }];
      await expect(
        safeFetch("https://evil-rebind.com/keys", {
          dnsLookup: mockDns as any,
        })
      ).rejects.toThrow("blocked IP 127.0.0.1");
    });
  });

  describe("safeFetch Redirect Security", () => {
    it("blocks redirects aiming at private/cloud metadata IPs", async () => {
      const mockFetch: any = async (url: string) => {
        if (url === "https://public.example.com/redirect") {
          return new Response(null, {
            status: 302,
            headers: { Location: "http://169.254.169.254/latest/meta-data" },
          });
        }
        return new Response("ok", { headers: { "Content-Type": "text/html" } });
      };

      const mockDns = async () => [{ address: "93.184.216.34", family: 4 }];

      await expect(
        safeFetch("https://public.example.com/redirect", {
          fetchFn: mockFetch,
          dnsLookup: mockDns as any,
        })
      ).rejects.toThrow("Direct IP destination 169.254.169.254 is blocked");
    });

    it("detects and terminates redirect loops", async () => {
      const mockFetch: any = async (url: string) => {
        if (url === "https://public.example.com/a") {
          return new Response(null, {
            status: 301,
            headers: { Location: "https://public.example.com/b" },
          });
        }
        if (url === "https://public.example.com/b") {
          return new Response(null, {
            status: 301,
            headers: { Location: "https://public.example.com/a" },
          });
        }
        return new Response("ok");
      };

      const mockDns = async () => [{ address: "93.184.216.34", family: 4 }];

      await expect(
        safeFetch("https://public.example.com/a", {
          fetchFn: mockFetch,
          dnsLookup: mockDns as any,
        })
      ).rejects.toThrow("Redirect loop detected");
    });

    it("enforces maximum redirect limit (3 hops)", async () => {
      let hop = 0;
      const mockFetch: any = async () => {
        hop++;
        return new Response(null, {
          status: 302,
          headers: { Location: `https://public.example.com/hop-${hop}` },
        });
      };

      const mockDns = async () => [{ address: "93.184.216.34", family: 4 }];

      await expect(
        safeFetch("https://public.example.com/hop-0", {
          fetchFn: mockFetch,
          dnsLookup: mockDns as any,
          maxRedirects: 3,
        })
      ).rejects.toThrow("Maximum redirect limit of 3 hops exceeded");
    });
  });

  describe("safeFetch Content-Type & Payload Cutoff", () => {
    it("rejects disallowed content-types like images or executables", async () => {
      const mockFetch: any = async () => {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      };
      const mockDns = async () => [{ address: "93.184.216.34", family: 4 }];

      await expect(
        safeFetch("https://public.example.com/photo.png", {
          fetchFn: mockFetch,
          dnsLookup: mockDns as any,
        })
      ).rejects.toThrow("Disallowed content-type 'image/png'");
    });

    it("enforces payload cutoff when response exceeds maxBytes", async () => {
      const largePayload = "A".repeat(500);
      const mockFetch: any = async () => {
        return new Response(largePayload, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      };
      const mockDns = async () => [{ address: "93.184.216.34", family: 4 }];

      await expect(
        safeFetch("https://public.example.com/huge-page", {
          fetchFn: mockFetch,
          dnsLookup: mockDns as any,
          maxBytes: 100, // Small limit for test
        })
      ).rejects.toThrow("Response body cutoff reached");
    });

    it("succeeds when content-type is allowed and size is within limit", async () => {
      const mockFetch: any = async () => {
        return new Response("<html><head><title>Success</title></head></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      };
      const mockDns = async () => [{ address: "93.184.216.34", family: 4 }];

      const res = await safeFetch("https://public.example.com/page", {
        fetchFn: mockFetch,
        dnsLookup: mockDns as any,
      });

      expect(res.ok).toBe(true);
      const text = await res.text();
      expect(text).toContain("<title>Success</title>");
    });
  });
});
