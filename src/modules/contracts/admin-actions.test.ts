import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("admin contract generation action returns structured failures", () => {
  const actionsSource = readFileSync(
    join(process.cwd(), "src", "app", "(admin)", "admin", "contracts", "actions.ts"),
    "utf8",
  );
  const pageSource = readFileSync(
    join(process.cwd(), "src", "app", "(admin)", "admin", "contracts", "page.tsx"),
    "utf8",
  );
  const formSource = readFileSync(
    join(process.cwd(), "src", "app", "(admin)", "admin", "contracts", "generate-contract-form.tsx"),
    "utf8",
  );

  assert.match(actionsSource, /type GenerateContractActionState/);
  assert.match(actionsSource, /catch \(error\)/);
  assert.match(actionsSource, /Contract settings are incomplete|Unable to generate the contract/);
  assert.match(pageSource, /getCompanyContractSettings\(tenant\)/);
  assert.match(pageSource, /buildContractSettingsReadiness\(\{\}\)/);
  assert.match(formSource, /useActionState\(generateContractFormAction/);
  assert.match(formSource, /Configure contract settings before generating PDFs/);
  assert.match(formSource, /disabled=\{disabled\}/);
});
