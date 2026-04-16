/**
 * One-time backfill: compute and persist risk scores for all active transactions.
 *
 * All existing transactions start with riskScore = 0 (the schema default). This
 * script runs the same scoring logic used by the hourly Inngest sweep so that
 * operators see accurate risk badges and morning briefing data immediately after
 * the migration, rather than waiting up to an hour for the first sweep to run.
 *
 * Usage:
 *   npm run db:backfill:risk-scores
 *
 * The script reads DATABASE_URL (and other env vars) from the environment.
 * For local development, prefix the command with your vars or load your .env:
 *   DATABASE_URL="postgres://..." npm run db:backfill:risk-scores
 */

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { runDealRiskSweep } from "@/modules/transactions/risk-scoring";

async function main() {
  if (!featureFlags.hasDatabase) {
    console.error("DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  console.log("Fetching companies with active transactions...");

  const companies = await prisma.company.findMany({
    where: {
      transactions: {
        some: {
          currentStage: {
            notIn: ["FINAL_PAYMENT_COMPLETED", "HANDOVER_COMPLETED"],
          },
        },
      },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (companies.length === 0) {
    console.log("No companies with active transactions found. Nothing to backfill.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Backfilling risk scores for ${companies.length} company/companies.\n`);

  let totalScored = 0;
  let totalAtRisk = 0;
  let totalFirstAlerts = 0;
  const errors: { companyName: string; error: string }[] = [];

  for (const company of companies) {
    process.stdout.write(`  ${company.name.padEnd(40)} `);

    try {
      const result = await runDealRiskSweep({ companyId: company.id });
      totalScored += result.scored;
      totalAtRisk += result.atRiskCount;
      totalFirstAlerts += result.firstAlerts;

      const parts: string[] = [`scored=${result.scored}`];
      if (result.atRiskCount > 0) parts.push(`at-risk=${result.atRiskCount}`);
      if (result.firstAlerts > 0) parts.push(`new-alerts=${result.firstAlerts}`);
      console.log(parts.join("  "));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ companyName: company.name, error: message });
      console.log(`ERROR: ${message}`);
    }
  }

  console.log("\n--- Backfill complete ---");
  console.log(`  Transactions scored : ${totalScored}`);
  console.log(`  At-risk deals       : ${totalAtRisk}`);
  console.log(`  First-AT_RISK alerts: ${totalFirstAlerts}`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} company/companies failed:`);
    for (const e of errors) {
      console.error(`  - ${e.companyName}: ${e.error}`);
    }
  }

  await prisma.$disconnect();

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
