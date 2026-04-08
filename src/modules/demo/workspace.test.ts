import assert from "node:assert/strict";
import test from "node:test";

import { getPublicDemoWorkspace } from "@/modules/demo/workspace";

test("public demo workspace stays explicit and revenue-focused", () => {
  const demo = getPublicDemoWorkspace();

  assert.equal(demo.company.name, "Crestline Developments");
  assert.ok(demo.board.summary.totalDeals > 0);
  assert.ok(demo.board.summary.overdueAmount > 0);
  assert.equal(demo.board.columns.some((column) => column.key === "OVERDUE"), true);
  assert.equal(
    demo.board.columns.find((column) => column.key === "OVERDUE")?.cards.length,
    1,
  );
  assert.equal(demo.narrative.length, 3);
});
