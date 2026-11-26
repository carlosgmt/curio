import { describe, expect, it } from "bun:test";
import {
  buildCurioSaveToBookmarkletHref,
  classifyClipDestination,
  decodeUniversalClipFragment,
  encodeUniversalClipFragment,
} from "./protocol";

describe("Universal Save to Curio Clip Protocol", () => {
  it("builds a syntactically valid bookmarklet without raw '#' characters and round-trips UTF-8 fragments", () => {
    const href = buildCurioSaveToBookmarkletHref("https://mini.orca-banjo.ts.net/curio/clip");
    expect(href.startsWith("javascript:")).toBe(true);
    expect(href.includes("#")).toBe(false);
    expect(() => new Function(href.slice("javascript:".length))).not.toThrow();

    const payload = {
      url: "https://www.cos.com/en-ch/men/knitwear/merino-sweater.html",
      name: "Merino Sweater — CHF 135,00",
      brand: "COS",
      color: "Navy Blue",
      materialText: "80% Merino Wool, 20% Polyamide",
      price: "135,00",
      currency: "CHF",
      schemaTypes: ["Product"],
      images: ["https://cdn.cos.com/sweater.jpg"],
    };
    const token = encodeUniversalClipFragment(payload);
    const decoded = decodeUniversalClipFragment(`#clip=${token}`);
    expect(decoded).not.toBeNull();
    expect(decoded?.clip.brand).toBe("COS");
    expect(decoded?.clip.materialText).toBe("80% Merino Wool, 20% Polyamide");
    expect(decoded?.clip.schemaTypes).toEqual(["Product"]);

    const malicious = btoa(JSON.stringify({ url: "javascript:alert(1)" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(decodeUniversalClipFragment(`#clip=${malicious}`)).toBeNull();
  });

  it("routes apparel -> closet, recipes -> chef, gear/manuals -> my-stuff, and books/cinema/articles -> curio", () => {
    const closetRoute = classifyClipDestination({
      url: "https://www.zalando.ch/levis-501-straight-jeans-blue.html",
      name: "501 Original Jeans",
      price: "119.95",
      schemaTypes: ["Product"],
    });
    expect(closetRoute.destination).toBe("closet");
    expect(closetRoute.typePath).toBe("/product/garment");

    const chefRoute = classifyClipDestination({
      url: "https://www.seriouseats.com/best-risotto",
      name: "Mushroom Risotto",
      schemaTypes: ["Recipe"],
      recipe: { ingredients: ["300g Arborio rice", "1L vegetable stock"], instructions: ["Simmer"] },
    });
    expect(chefRoute.destination).toBe("chef");
    expect(chefRoute.typePath).toBe("/culinary/recipe");

    const myStuffRoute = classifyClipDestination({
      url: "https://www.galaxus.ch/en/s1/product/sony-alpha-7-iv-123456",
      name: "Sony Alpha 7 IV Mirrorless Camera",
      price: 2299,
      currency: "CHF",
      sku: "ILCE7M4B",
      manualUrl: "https://sony.com/support/a7iv-manual.pdf",
      schemaTypes: ["Product"],
    });
    expect(myStuffRoute.destination).toBe("my-stuff");
    expect(myStuffRoute.typePath).toBe("/product/electronics");

    const bookRoute = classifyClipDestination({
      url: "https://www.amazon.com/dp/0140449132",
      name: "The Count of Monte Cristo",
      schemaTypes: ["Book", "Product"],
    });
    expect(bookRoute.destination).toBe("curio");
    expect(bookRoute.typePath).toBe("/product/book");

    const filmRoute = classifyClipDestination({
      url: "https://letterboxd.com/film/past-lives/",
      name: "Past Lives",
      schemaTypes: ["Movie"],
    });
    expect(filmRoute.destination).toBe("curio");
    expect(filmRoute.typePath).toBe("/media/film");

    const quoteRoute = classifyClipDestination({
      url: "https://paulgraham.com/greatwork.html",
      name: "How to Do Great Work",
      selection: "Do things that interest you deeply.",
    });
    expect(quoteRoute.destination).toBe("curio");
    expect(quoteRoute.typePath).toBe("/quote");

    const igRecipeRoute = classifyClipDestination({
      url: "https://www.instagram.com/reel/ABC123/",
      name: "Arroz meloso de setas",
      schemaTypes: ["VideoObject"],
      caption:
        "Ingredientes:\n- 300g arroz bomba\n- 250g setas\n- 1L caldo\nPreparación: cocinar 18 min.",
    });
    expect(igRecipeRoute.destination).toBe("chef");
    expect(igRecipeRoute.typePath).toBe("/culinary/recipe");

    const igCasualRoute = classifyClipDestination({
      url: "https://www.instagram.com/reel/XYZ999/",
      name: "Weekend walk in Zurich",
      schemaTypes: ["VideoObject"],
      caption: "Sunday coffee and lake views with friends.",
    });
    expect(igCasualRoute.destination).toBe("curio");
    expect(igCasualRoute.typePath).toBe("/media/film");
  });
});
