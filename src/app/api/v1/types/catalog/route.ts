import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthError } from "@/lib/auth/service";
import {
  listAllTypes,
  getCatalogTypes,
  installCatalogType,
  uninstallCatalogType,
  isTypeInstalled,
} from "@/lib/types/service";

const installPayloadSchema = z.object({
  id: z.string().optional(),
  typeId: z.string().optional(),
  typePath: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const userTypes = await listAllTypes(user.id);
    const catalog = getCatalogTypes();

    const result = catalog.map((item) => {
      const installed = userTypes.find(
        (t) => t.typePath.toLowerCase() === item.typePath.toLowerCase() && (t.userId === user.id || t.userId === null)
      );

      return {
        ...item,
        isInstalled: Boolean(installed),
        installedTypeId: installed?.id || null,
        isCanonical: installed ? installed.userId === null : false,
      };
    });

    return NextResponse.json({ catalog: result });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = installPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload: id, typeId, or typePath is required", details: parsed.error },
        { status: 400 }
      );
    }

    const target = parsed.data.typeId || parsed.data.id || parsed.data.typePath;
    if (!target) {
      return NextResponse.json(
        { error: "Missing required catalog identifier (id, typeId, or typePath)" },
        { status: 400 }
      );
    }

    const installedType = await installCatalogType(user.id, target);
    return NextResponse.json({ success: true, type: installedType }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);

    // Support query params or json body
    let target = req.nextUrl.searchParams.get("typePath") || req.nextUrl.searchParams.get("id");
    if (!target) {
      try {
        const body = await req.json();
        target = body?.typePath || body?.id || body?.typeId;
      } catch {
        // Body optional
      }
    }

    if (!target) {
      return NextResponse.json(
        { error: "Missing target type identifier (id, typeId, or typePath)" },
        { status: 400 }
      );
    }

    const success = await uninstallCatalogType(user.id, target);
    if (!success) {
      return NextResponse.json(
        { error: "Type not found or already inactive for user" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Type uninstalled successfully" });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
