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

    it("resolves multilingual book with title + author ('Plomo by Jose Luis Sastre') via Apple Books when OpenLibrary misses and Google Books returns 429", async () => {
      const mockFetch: any = async (input: RequestInfo | URL) => {
        const u = String(input);
        if (u.includes("itunes.apple.com/search") && u.includes("media=ebook")) {
          return new Response(
            JSON.stringify({
              resultCount: 1,
              results: [
                {
                  trackId: 6758959746,
                  trackName: "Plomo",
                  artistName: "José Luis Sastre",
                  releaseDate: "2026-03-12T07:00:00Z",
                  artworkUrl100:
                    "https://is1-ssl.mzstatic.com/image/thumb/Publication211/v4/46/64/97/9788401037115.jpg/100x100bb.jpg",
                  description: "<b>Hay gente que, al escoger su deber, escoge también su destino.</b>",
                  trackViewUrl: "https://books.apple.com/us/book/plomo/id6758959746?uo=4",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (u.includes("openlibrary.org")) {
          return new Response(JSON.stringify({ numFound: 0, docs: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("googleapis.com/books")) {
          return new Response("Rate limit exceeded", { status: 429 });
        }
        return new Response("Not found", { status: 404 });
      };

      const book = await resolveBook("Plomo by Jose Luis Sastre", {
        fetchFn: mockFetch,
        requireStrongMatch: true,
      });
      expect(book).not.toBeNull();
      expect(book?.title).toBe("Plomo");
      expect(book?.author).toBe("José Luis Sastre");
      expect(book?.releaseYear).toBe(2026);
      expect(book?.coverUrl).toContain("600x600bb.jpg");
      expect(book?.isbn).toBe("9788401037115");
      expect(book?.summary).not.toContain("<b>");
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

    it("overrides unrelated Wikipedia creator hits when 'Plomo by Jose Luis Sastre' matches Apple Books strongly", async () => {
      const mockFetch: any = async (input: RequestInfo | URL) => {
        const u = String(input);
        if (u.includes("itunes.apple.com/search") && u.includes("media=ebook")) {
          return new Response(
            JSON.stringify({
              resultCount: 1,
              results: [
                {
                  trackId: 6758959746,
                  trackName: "Plomo",
                  artistName: "José Luis Sastre",
                  releaseDate: "2026-03-12T07:00:00Z",
                  artworkUrl100:
                    "https://is1-ssl.mzstatic.com/image/thumb/Publication211/v4/9788401037115.jpg/100x100bb.jpg",
                  description: "Una novela absorbente.",
                  trackViewUrl: "https://books.apple.com/us/book/plomo/id6758959746",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ results: [], docs: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const payload = await enrichCaptureInput("Plomo by Jose Luis Sastre", {
        fetchFn: mockFetch,
        skipCache: true,
        universalCandidates: [
          {
            title: "Francisco Nieva",
            snippet: "Spanish author",
            url: "https://en.wikipedia.org/wiki/Francisco_Nieva",
            coreType: "CREATOR",
            typePath: "/person/author",
            badgeLabel: "AUTHOR",
          },
        ],
      });

      expect(payload.title).toBe("Plomo");
      expect(payload.brandOrCreator).toBe("José Luis Sastre");
      expect(payload.typePath).toBe("/product/book");
      expect(payload.coreType).toBe("BOOK");
      expect(payload.heroImageUrl).toContain("600x600bb.jpg");

      const barePayload = await enrichCaptureInput("Plomo Jose Luis Sastre", {
        fetchFn: mockFetch,
        skipCache: true,
        universalCandidates: [
          {
            title: "José Luis Sastre",
            snippet: "Spanish journalist",
            url: "https://en.wikipedia.org/wiki/Jos%C3%A9_Luis_Sastre",
            coreType: "PRODUCT",
            typePath: "/product/generic",
            badgeLabel: "ITEM",
          },
        ],
      });
      expect(barePayload.title).toBe("Plomo");
      expect(barePayload.brandOrCreator).toBe("José Luis Sastre");
      expect(barePayload.typePath).toBe("/product/book");
    });
  });
});
