import { readFileSync } from "fs";
import { expect, test } from "vitest";

const sql = readFileSync("supabase/schema.sql", "utf8");
test("schema has extension cap column and pending order lifecycle", () => {
  expect(sql).toMatch("extensions_used");
  expect(sql).toMatch("'pending','paid','expired','cancelled'");
  expect(sql).toMatch("enable row level security");
});
test("schema grants clients no writes (api-only writes)", () => {
  expect(sql).toMatch('for select to anon, authenticated');
  expect(sql).not.toMatch('for insert to anon');
  expect(sql).not.toMatch('for insert to authenticated');
  expect(sql).not.toMatch('for update to anon');
  expect(sql).not.toMatch('for update to authenticated');
});
