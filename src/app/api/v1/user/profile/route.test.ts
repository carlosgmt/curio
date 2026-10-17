import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { GET, PATCH } from "./route";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth/session";

describe("User Profile & Creator Monetization API Route (/api/v1/user/profile)", () => {
  it("GET returns authenticated user profile with affiliate tags and custom domain", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `profile-get-${timestamp}@curio.local`,
        username: `profile_get_${timestamp}`,
        displayName: "Curator Alex",
        customDomain: "curator.art",
        affiliateTags: {
          amazon: "alex-20",
          bookshop: "alex-reads",
        },
      })
      .returning();

    const { token } = await createSession(user.id);

    const req = new NextRequest("http://localhost:3000/api/v1/user/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe(user.id);
    expect(data.user.displayName).toBe("Curator Alex");
    expect(data.user.customDomain).toBe("curator.art");
    expect(data.user.affiliateTags).toEqual({
      amazon: "alex-20",
      bookshop: "alex-reads",
    });
  });

  it("PATCH updates displayName, avatarUrl, customDomain, and affiliateTags", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `profile-patch-${timestamp}@curio.local`,
        username: `profile_patch_${timestamp}`,
        displayName: "Old Name",
      })
      .returning();

    const { token } = await createSession(user.id);

    const patchPayload = {
      displayName: "New Aesthetic Name",
      avatarUrl: "https://images.unsplash.com/photo-avatar",
      customDomain: "gallery.aesthetic.design",
      affiliateTags: {
        amazon: "aesthetic-20",
        bookshop: "aesthetic-books",
        ltk: "aesthetic_look",
        skimlinks: "skim999",
        customRef: "aesthetic-ref",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/v1/user/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patchPayload),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.displayName).toBe("New Aesthetic Name");
    expect(data.user.avatarUrl).toBe("https://images.unsplash.com/photo-avatar");
    expect(data.user.customDomain).toBe("gallery.aesthetic.design");
    expect(data.user.affiliateTags).toEqual({
      amazon: "aesthetic-20",
      bookshop: "aesthetic-books",
      ltk: "aesthetic_look",
      skimlinks: "skim999",
      customRef: "aesthetic-ref",
    });

    // Check DB record
    const [persisted] = await db.select().from(users).where(eq(users.id, user.id));
    expect(persisted.affiliateTags).toEqual({
      amazon: "aesthetic-20",
      bookshop: "aesthetic-books",
      ltk: "aesthetic_look",
      skimlinks: "skim999",
      customRef: "aesthetic-ref",
    });
  });

  it("PATCH rejects invalid payload with 400 Bad Request", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `profile-invalid-${timestamp}@curio.local`,
        username: `profile_invalid_${timestamp}`,
      })
      .returning();

    const { token } = await createSession(user.id);

    const req = new NextRequest("http://localhost:3000/api/v1/user/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        avatarUrl: "not-a-valid-url",
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid profile update payload");
  });

  it("rejects unauthorized access when invalid token is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/user/profile", {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-expired-token",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
