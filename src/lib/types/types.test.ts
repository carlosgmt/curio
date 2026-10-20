import { describe, expect, it } from "bun:test";
import {
  listAllTypes,
  getTypeById,
  deleteCustomType,
  registerCustomType,
} from "./service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

describe("Custom Types & Hierarchical Ontology Service", () => {
  it("lists all seeded canonical archetypes", async () => {
    const types = await listAllTypes();
    expect(types.length).toBeGreaterThanOrEqual(8);

    const typePaths = types.map((t) => t.typePath);
    expect(typePaths).toContain("/media/film");
    expect(typePaths).toContain("/product/book");
    expect(typePaths).toContain("/media/music/vinyl");
    expect(typePaths).toContain("/culinary/recipe");
  });

  it("registers a specialized custom type with JSON schema and public fields", async () => {
    const user = await getOrCreateDefaultUser();

    const customType = await registerCustomType(user.id, {
      name: "Japanese Incense",
      parentTypePath: "/product",
      defaultSilhouette: "swatch",
      fields: [
        {
          key: "burnTimeMinutes",
          label: "Burn Time (Minutes)",
          type: "number",
        },
        {
          key: "scentFamily",
          label: "Scent Family",
          type: "select",
          options: ["Sandalwood", "Agarwood / Kyara", "Floral", "Green Tea"],
        },
        {
          key: "makerPrefecture",
          label: "Maker Prefecture",
          type: "string",
        },
      ],
      extractionPrompt: "Extract incense burn time, scent profile notes, and Japanese maker prefecture.",
    });

    expect(customType.id).toBeDefined();
    expect(customType.name).toBe("Japanese Incense");
    expect(customType.typePath).toBe("/product/japanese-incense");
    expect(customType.defaultSilhouette).toBe("swatch");
    expect(customType.userId).toBe(user.id);
    expect(customType.publicFieldKeys).toEqual(["burnTimeMinutes", "scentFamily", "makerPrefecture"]);

    const schema = customType.jsonSchema as any;
    expect(schema.type).toBe("object");
    expect(schema.properties.burnTimeMinutes.type).toBe("number");
    expect(schema.properties.scentFamily.enum).toContain("Sandalwood");
    expect(schema.properties.makerPrefecture.type).toBe("string");

    // Verify lookup by ID
    const retrieved = await getTypeById(customType.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(customType.id);
    expect(retrieved?.name).toBe("Japanese Incense");
  });

  it("prevents deleting canonical root archetypes", async () => {
    const types = await listAllTypes();
    const canonicalBook = types.find((t) => t.typePath === "/product/book");
    expect(canonicalBook).toBeDefined();

    expect(deleteCustomType(canonicalBook!.id)).rejects.toThrow("CANNOT_DELETE_CANONICAL_TYPE");
  });

  it("allows deleting custom types and cascades properly", async () => {
    const user = await getOrCreateDefaultUser();

    const tempType = await registerCustomType(user.id, {
      name: "Temporary Test Type",
      parentTypePath: "/product",
      fields: [{ key: "testField", label: "Test", type: "string" }],
    });

    const success = await deleteCustomType(tempType.id, user.id);
    expect(success).toBe(true);

    const lookup = await getTypeById(tempType.id);
    expect(lookup).toBeNull();
  });

  it("lists secondary catalog types including Quote, Watch, Coffee, Fragrance, Podcast", async () => {
    const { getCatalogTypes, getCatalogTypeByPath } = await import("./catalog");
    const catalog = getCatalogTypes();
    expect(catalog.length).toBeGreaterThanOrEqual(5);

    const paths = catalog.map((c) => c.typePath);
    expect(paths).toContain("/quote");
    expect(paths).toContain("/product/watch");
    expect(paths).toContain("/product/beverage/coffee");
    expect(paths).toContain("/product/cosmetics/fragrance");
    expect(paths).toContain("/media/podcast");

    const quoteDef = getCatalogTypeByPath("/quote");
    expect(quoteDef).toBeDefined();
    expect(quoteDef?.fields.map((f) => f.key)).toEqual(["text", "author", "date", "work"]);
  });

  it("installs, exports, imports with overlay, and uninstalls a secondary catalog type", async () => {
    const user = await getOrCreateDefaultUser();
    const {
      installCatalogType,
      uninstallCatalogType,
      exportTypeAsSchemaSpec,
      importSchemaSpec,
      isTypeInstalled,
      listAllTypes,
    } = await import("./service");

    // 1. Install Quote type
    const installed = await installCatalogType(user.id, "quote");
    expect(installed).toBeDefined();
    expect(installed.name).toBe("Quote");
    expect(installed.typePath).toBe("/quote");
    expect(installed.userId).toBe(user.id);

    const userTypes = await listAllTypes(user.id);
    expect(isTypeInstalled("/quote", userTypes, user.id)).toBe(true);

    // 2. Export Schema Spec
    const exportedSpec = await exportTypeAsSchemaSpec(installed.id, user.id);
    expect(exportedSpec.schemaVersion).toBe("1.0");
    expect(exportedSpec.curioType.name).toBe("Quote");
    expect(exportedSpec.curioType.typePath).toBe("/quote");
    expect(exportedSpec.curioType.fields.map((f) => f.key)).toContain("author");

    // 3. Import Schema Spec with contract + overlay
    // Simulate an imported schema with an added upstream field 'translator'
    const modifiedSpec = JSON.parse(JSON.stringify(exportedSpec));
    modifiedSpec.curioType.fields.push({
      key: "translator",
      label: "Translator",
      type: "string",
    });
    modifiedSpec.curioType.jsonSchema.properties.translator = { type: "string", title: "Translator" };

    const imported = await importSchemaSpec(user.id, modifiedSpec);
    expect(imported).toBeDefined();
    const effectiveSchema = imported.effectiveJsonSchema as any;
    expect(effectiveSchema.properties.translator).toBeDefined();
    expect(effectiveSchema.properties.author).toBeDefined();

    // 4. Uninstall catalog type
    const uninstalled = await uninstallCatalogType(user.id, "/quote");
    expect(uninstalled).toBe(true);

    const afterUserTypes = await listAllTypes(user.id);
    expect(isTypeInstalled("/quote", afterUserTypes, user.id)).toBe(false);
  });
});

