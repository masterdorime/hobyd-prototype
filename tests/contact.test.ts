import { vi } from "vitest";
import { normalizeContact, validateContact, waLink } from "../lib/contact";

vi.mock("@/lib/supabase/admin", () => ({ adminDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));

import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { POST as contactPOST } from "../app/api/orders/[id]/contact/route";

test("normalizeContact strips to digits", () => {
  expect(normalizeContact("+62 812-3456-7890")).toBe("6281234567890");
  expect(normalizeContact("0812 345 678")).toBe("0812345678");
  expect(normalizeContact(undefined)).toBe("");
});

test("validateContact requires 8–15 digits", () => {
  expect(validateContact("0812345678")).toBe(true);
  expect(validateContact("+62 812-3456-7890")).toBe(true);
  expect(validateContact("1234567")).toBe(false);
  expect(validateContact("1".repeat(16))).toBe(false);
  expect(validateContact("")).toBe(false);
});

test("waLink builds a wa.me URL", () => {
  expect(waLink("+62 812-3456-7890")).toBe("https://wa.me/6281234567890");
});

const OID = "123e4567-e89b-12d3-a456-426614174000";
function ctx(id: string = OID) {
  return { params: Promise.resolve({ id }) } as any;
}
function req(body: unknown) {
  return new Request("http://localhost/", { method: "POST", body: JSON.stringify(body) });
}

test("contact route enforces winner-only, validated update", async () => {
  vi.mocked(requireUser).mockRejectedValue(new Error("nope"));
  expect((await contactPOST(req({ contact: "0812345678" }), ctx())).status).toBe(401);
  vi.mocked(requireUser).mockResolvedValue({ id: "w", email: "w@e" } as any);
  expect((await contactPOST(req({ contact: "0812345678" }), ctx("nope"))).status).toBe(404);
  expect((await contactPOST(req({ contact: "123" }), ctx())).status).toBe(400);
  vi.mocked(adminDb).mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { winner: "other" } }) }) }),
    }),
  } as any);
  expect((await contactPOST(req({ contact: "0812345678" }), ctx())).status).toBe(403);
  const updated: { patch?: unknown } = {};
  vi.mocked(adminDb).mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { winner: "w" } }) }) }),
      update: (patch: unknown) => ({
        eq: () => ({
          select: () => ({
            single: async () => {
              updated.patch = patch;
              return { data: { id: OID, ...((patch as object) ?? {}) }, error: null };
            },
          }),
        }),
      }),
    }),
  } as any);
  const res = await contactPOST(req({ contact: "0812-345-678" }), ctx());
  expect(res.status).toBe(200);
  expect(updated.patch).toEqual({ winner_contact: "0812-345-678" });
});
