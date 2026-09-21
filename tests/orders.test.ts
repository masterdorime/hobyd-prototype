// tests/orders.test.ts
import { vi } from "vitest";
import { createHash } from "crypto";

vi.mock("@/lib/supabase/admin", () => ({ adminDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));

import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { POST as webhookPOST } from "../app/api/orders/webhook/route";
import { POST as confirmPOST, canConfirm } from "../app/api/orders/[id]/mock-confirm/route";
import { isExpired } from "../app/api/orders/[id]/expire/route";

test("only winner confirms", () => {
  expect(canConfirm({ caller: "w", winner: "w" })).toBe(true);
  expect(canConfirm({ caller: "x", winner: "w" })).toBe(false);
});
test("order expires only after the payment window", () => {
  expect(isExpired({ createdAtMs: 0, nowMs: 299_999, windowSec: 300 })).toBe(false);
  expect(isExpired({ createdAtMs: 0, nowMs: 300_000, windowSec: 300 })).toBe(true);
  expect(isExpired({ createdAtMs: 1_000, nowMs: 301_000, windowSec: 300 })).toBe(true);
});

// In-memory fake of the supabase query builder, honoring chained .eq filters
// so conditional writes (.eq("id",…).eq("status","pending")) behave like prod.
function makeDb(seed: Record<string, any>) {
  const store = new Map(Object.entries(seed));
  const fake = {
    store,
    from(table: string) {
      if (table !== "orders") throw new Error("only orders supported");
      return {
        select() {
          const filters: Array<(r: any) => boolean> = [];
          const b: any = {
            eq: (k: string, v: any) => {
              filters.push((r) => r[k] === v);
              return b;
            },
            single: async () => ({
              data: [...store.values()].find((r) => filters.every((f) => f(r))) ?? null,
            }),
          };
          return b;
        },
        update(patch: any) {
          const filters: Array<(r: any) => boolean> = [];
          const b: any = {
            eq: (k: string, v: any) => {
              filters.push((r) => r[k] === v);
              return b;
            },
            select: async () => {
              const out: Array<{ id: string }> = [];
              for (const [id, row] of store) {
                if (filters.every((f) => f(row))) {
                  store.set(id, { ...row, ...patch });
                  out.push({ id });
                }
              }
              return { data: out };
            },
          };
          return b;
        },
      };
    },
  };
  return fake;
}

const KEY = "test-key";
function signed(body: Record<string, string>) {
  const raw = `${body.order_id}${body.status_code}${body.gross_amount}${KEY}`;
  return { ...body, signature_key: createHash("sha512").update(raw).digest("hex") };
}
function notifyReq(body: Record<string, string>) {
  return new Request("http://localhost/api/orders/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function confirmCtx(id: string) {
  return { params: Promise.resolve({ id }) } as any;
}

test("webhook: late settlement on expired order noops (stays terminal)", async () => {
  process.env.MIDTRANS_SERVER_KEY = KEY;
  const fake = makeDb({ o1: { id: "o1", status: "expired", paid_at: null } });
  vi.mocked(adminDb).mockReturnValue(fake as any);
  const res = await webhookPOST(
    notifyReq(
      signed({ order_id: "o1", status_code: "200", gross_amount: "10000", transaction_status: "settlement" }),
    ),
  );
  expect(await res.json()).toEqual({ noop: true });
  expect(fake.store.get("o1").status).toBe("expired");
  expect(fake.store.get("o1").paid_at).toBeNull();
});

test("webhook: duplicate settlement noops and keeps first paid_at", async () => {
  process.env.MIDTRANS_SERVER_KEY = KEY;
  const fake = makeDb({ o1: { id: "o1", status: "pending", paid_at: null } });
  vi.mocked(adminDb).mockReturnValue(fake as any);
  const body = () =>
    signed({ order_id: "o1", status_code: "200", gross_amount: "10000", transaction_status: "settlement" });
  const first = await webhookPOST(notifyReq(body()));
  expect(await first.json()).toEqual({ paid: true });
  const firstPaidAt = fake.store.get("o1").paid_at;
  expect(fake.store.get("o1").status).toBe("paid");
  expect(typeof firstPaidAt).toBe("string");
  const second = await webhookPOST(notifyReq(body()));
  expect(await second.json()).toEqual({ noop: true });
  expect(fake.store.get("o1").paid_at).toBe(firstPaidAt);
});

test("mock-confirm: expired order noops (no expired→paid resurrection)", async () => {
  const fake = makeDb({ o2: { id: "o2", status: "expired", winner: "w", paid_at: null } });
  vi.mocked(adminDb).mockReturnValue(fake as any);
  vi.mocked(requireUser).mockResolvedValue({ id: "w", email: "w@e" } as any);
  const res = await confirmPOST(new Request("http://localhost/", { method: "POST" }), confirmCtx("o2"));
  expect(await res.json()).toEqual({ noop: true });
  expect(fake.store.get("o2").status).toBe("expired");
  expect(fake.store.get("o2").paid_at).toBeNull();
});

test("mock-confirm: double-confirm noops and keeps first paid_at", async () => {
  const fake = makeDb({ o3: { id: "o3", status: "pending", winner: "w", paid_at: null } });
  vi.mocked(adminDb).mockReturnValue(fake as any);
  vi.mocked(requireUser).mockResolvedValue({ id: "w", email: "w@e" } as any);
  const first = await confirmPOST(new Request("http://localhost/", { method: "POST" }), confirmCtx("o3"));
  expect(await first.json()).toEqual({ paid: true });
  const firstPaidAt = fake.store.get("o3").paid_at;
  expect(typeof firstPaidAt).toBe("string");
  const second = await confirmPOST(new Request("http://localhost/", { method: "POST" }), confirmCtx("o3"));
  expect(await second.json()).toEqual({ noop: true });
  expect(fake.store.get("o3").paid_at).toBe(firstPaidAt);
});
