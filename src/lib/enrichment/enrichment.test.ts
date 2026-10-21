import { describe, expect, it } from "bun:test";
import { parseHtmlMetadata } from "./opengraph";
import { resolveBook } from "./providers/books";
import { resolveSpotifyUrl } from "./providers/music";
import { enrichCaptureInput } from "./dispatcher";

describe("Live External Enrichment Engine", () => {
  describe("OpenGraph & JSON-LD HTML Extractor", () => {
    it("extracts standard OpenGraph tags from HTML", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ignored Standard Title</title>
            <meta property="og:title" content="Mode Sonnet Keyboard" />
            <meta property="og:description" content="A premium mechanical keyboard designed for focus." />
            <meta property="og:image" content="https://modedesigns.com/images/sonnet.jpg" />
            <meta property="og:site_name" content="Mode Designs" />
            <meta property="og:url" content="https://modedesigns.com/sonnet" />
          </head>
        </html>
      `;

      const meta = parseHtmlMetadata(html, "https://modedesigns.com/sonnet");
      expect(meta.title).toBe("Mode Sonnet Keyboard");
      expect(meta.description).toContain("premium mechanical keyboard");
      expect(meta.image).toBe("https://modedesigns.com/images/sonnet.jpg");
      expect(meta.siteName).toBe("Mode Designs");
    });

    it("parses JSON-LD Product with price and brand", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org/",
                "@type": "Product",
                "name": "Braun ET66 Calculator",
                "image": "https://braun.com/et66.png",
                "description": "Designed by Dieter Rams in 1987.",
                "brand": {
                  "@type": "Brand",
                  "name": "Braun"
                },
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "USD",
                  "price": "49.00"
                }
              }
            </script>
          </head>
        </html>
      `;

      const meta = parseHtmlMetadata(html);
      expect(meta.title).toBe("Braun ET66 Calculator");
      expect(meta.authorOrCreator).toBe("Braun");
      expect(meta.price).toBe(4900); // 49.00 -> 4900 cents
      expect(meta.currency).toBe("USD");
      expect(meta.structuredType).toBe("PRODUCT");
    });

    it("parses JSON-LD Book with author and ISBN", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "Book",
                "name": "The Design of Everyday Things",
                "author": {
                  "@type": "Person",
                  "name": "Don Norman"
                },
                "isbn": "9780465050659"
              }
            </script>
          </head>
        </html>
      `;

      const meta = parseHtmlMetadata(html);
      expect(meta.title).toBe("The Design of Everyday Things");
      expect(meta.authorOrCreator).toBe("Don Norman");
      expect(meta.structuredType).toBe("BOOK");
      expect(meta.typePath).toBe("/product/book");
    });
  });

  describe("Books Provider Resolver", () => {
    it("resolves book attributes from mocked OpenLibrary response", async () => {
      const mockFetch: any = async () =>
        new Response(
          JSON.stringify({
            docs: [
              {
                title: "Klara and the Sun",
                author_name: ["Kazuo Ishiguro"],
                isbn: ["9780593318171"],
                first_publish_year: 2021,
                number_of_pages_median: 303,
                publisher: ["Faber and Faber"],
                cover_i: 10423190,
                key: "/works/OL21132646W",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );

      const book = await resolveBook("Klara and the Sun book", { fetchFn: mockFetch });
      expect(book).not.toBeNull();
      expect(book?.title).toBe("Klara and the Sun");
      expect(book?.author).toBe("Kazuo Ishiguro");
      expect(book?.releaseYear).toBe(2021);
      expect(book?.coverUrl).toBe("https://covers.openlibrary.org/b/id/10423190-L.jpg");
      expect(book?.typePath).toBe("/product/book");
      expect(book?.canonicalExternalId).toBe("isbn:9780593318171");
    });
  });

  describe("Spotify oEmbed Resolver", () => {
    it("resolves Spotify album metadata from oEmbed endpoint", async () => {
      const mockFetch: any = async () =>
        new Response(
          JSON.stringify({
            title: "In Rainbows - Radiohead",
            author_name: "Radiohead",
            thumbnail_url: "https://i.scdn.co/image/ab67616d0000b273",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );

      const music = await resolveSpotifyUrl("https://open.spotify.com/album/5vkqYmiPBYLaalcmEQPpoh", {
        fetchFn: mockFetch,
      });

      expect(music).not.toBeNull();
      expect(music?.title).toBe("In Rainbows");
      expect(music?.artist).toBe("Radiohead");
      expect(["/media/music/album", "/media/music/vinyl"]).toContain(music?.typePath || "");
      expect(music?.coreType).toBe("MEDIA");
    });
  });

  describe("Unified Live Enrichment Dispatcher", () => {
    it("dispatches live URL enrichment with OpenGraph and primary source", async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="Field Notes Pitch Black" />
            <meta property="og:description" content="Dot-graph memo books" />
            <meta property="og:site_name" content="Field Notes" />
          </head>
        </html>
      `;

      const mockFetch: any = async () =>
        new Response(mockHtml, { status: 200, headers: { "Content-Type": "text/html" } });

      const payload = await enrichCaptureInput("https://fieldnotesbrand.com/products/pitch-black-memo-book", {
        fetchFn: mockFetch,
      });

      expect(payload.title).toBe("Field Notes Pitch Black");
      expect(payload.brandOrCreator).toBe("Field Notes");
      expect(payload.primarySource?.sellerName).toBe("Field Notes");
    });
  });
});
