import { describe, expect, it } from "bun:test";
import { parseBookmarksHTML, hydrateTopBookmarks } from "./bookmarks";

describe("Browser Bookmarks Netscape HTML Parser", () => {
  const sampleBookmarksHtml = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1710000000">Design &amp; Architecture</H3>
    <DL><p>
        <DT><H3 ADD_DATE="1710000500">Inspiration</H3>
        <DL><p>
            <DT><A HREF="https://archdaily.com" ADD_DATE="1710001000" TAGS="architecture,inspiration">ArchDaily</A>
            <DT><A HREF="https://siteinspire.com" ADD_DATE="1710002000" TAGS="web,minimal">SiteInspire</A>
        </DL><p>
        <DT><A HREF="https://dezeen.com" ADD_DATE="1710003000">Dezeen</A>
    </DL><p>
    <DT><H3 ADD_DATE="1710004000">Typography</H3>
    <DL><p>
        <DT><A HREF="https://fontsinuse.com" ADD_DATE="1710005000" TAGS="type,fonts">Fonts In Use</A>
    </DL><p>
</DL><p>`;

  it("parses nested Netscape HTML folder hierarchies and attributes correctly", () => {
    const bookmarks = parseBookmarksHTML(sampleBookmarksHtml);
    expect(bookmarks.length).toBe(4);

    // Item 1: ArchDaily
    const b1 = bookmarks[0];
    expect(b1.title).toBe("ArchDaily");
    expect(b1.url).toBe("https://archdaily.com");
    expect(b1.folderPath).toBe("Design & Architecture / Inspiration");
    expect(b1.tags).toContain("architecture");
    expect(b1.tags).toContain("inspiration");
    expect(b1.tags).toContain("archdaily.com");
    expect(b1.addDate).toBeDefined();
    expect(new Date(b1.addDate!).getFullYear()).toBe(2024);

    // Item 3: Dezeen (one level up)
    const b3 = bookmarks[2];
    expect(b3.title).toBe("Dezeen");
    expect(b3.url).toBe("https://dezeen.com");
    expect(b3.folderPath).toBe("Design & Architecture");

    // Item 4: Fonts In Use (sibling folder)
    const b4 = bookmarks[3];
    expect(b4.title).toBe("Fonts In Use");
    expect(b4.url).toBe("https://fontsinuse.com");
    expect(b4.folderPath).toBe("Typography");
  });

  it("applies ingestion throttling: items 21+ are LAZY_QUEUED", () => {
    let largeHtml = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>`;
    for (let i = 1; i <= 30; i++) {
      largeHtml += `<DT><A HREF="https://example.com/item-${i}">Item ${i}</A>\n`;
    }
    largeHtml += `</DL><p>`;

    const bookmarks = parseBookmarksHTML(largeHtml);
    expect(bookmarks.length).toBe(30);

    // Top 20 items are OPTIMISTIC
    expect(bookmarks[0].enrichmentStatus).toBe("OPTIMISTIC");
    expect(bookmarks[19].enrichmentStatus).toBe("OPTIMISTIC");

    // Items 21+ are LAZY_QUEUED
    expect(bookmarks[20].enrichmentStatus).toBe("LAZY_QUEUED");
    expect(bookmarks[29].enrichmentStatus).toBe("LAZY_QUEUED");
  });
});
