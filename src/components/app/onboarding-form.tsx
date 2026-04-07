"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DevCreateCompanyButton } from "@/components/app/dev-create-company-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function OnboardingForm({
  defaults,
  showDevShortcut,
}: {
  defaults: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
  showDevShortcut: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [adminFirstName, setAdminFirstName] = useState(defaults.firstName ?? "");
  const [adminLastName, setAdminLastName] = useState(defaults.lastName ?? "");
  const [adminEmail, setAdminEmail] = useState(defaults.email ?? "");
  const [includeSampleData, setIncludeSampleData] = useState(true);

  const suggestedSlug = useMemo(
    () => (companySlug.trim() ? companySlug : slugify(companyName)),
    [companyName, companySlug],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!companyName.trim()) {
      toast.error("Company name is required.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/app/onboarding", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          companySlug,
          adminFirstName,
          adminLastName,
          adminEmail,
          includeSampleData,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { redirectTo?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to create your workspace.");
      }

      toast.success("Workspace created. Opening the deal board.");
      router.push(payload.data?.redirectTo ?? "/admin");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create your workspace.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden bg-[linear-gradient(135deg,#08141b,#103842_45%,#d7c2a1_160%)] p-8 text-white sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Badge className="bg-white/12 text-white">Set up your company workspace</Badge>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
              Track deals, payments, and collections in one place.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
              Start with the basics. We will create your company workspace, assign your first
              admin, and take you straight to the Deal Board.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/68">
              <span className="rounded-full border border-white/12 px-3 py-1.5">1. Company</span>
              <span className="rounded-full border border-white/12 px-3 py-1.5">2. Admin</span>
              <span className="rounded-full border border-white/12 px-3 py-1.5">3. First workspace</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                "Lead visibility",
                "See new buyers, inspections, reservations, and follow-up risk in one board.",
              ],
              [
                "Payment operations",
                "Track payment requests, collected money, and overdue balances without spreadsheet cleanup.",
              ],
              [
                "Collections focus",
                "Know what is outstanding, who owns each deal, and what needs action next.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[28px] border border-white/12 bg-white/8 p-5 backdrop-blur">
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-2 text-sm leading-7 text-white/72">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-8 sm:p-10">
          <div className="space-y-8">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
                What happens next
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">
                Create the operating system for your sales team.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-600)]">
                This setup gives your company a live workspace for tracking buyers from inquiry to
                inspection, reservation, payment, receipt, and collections.
              </p>
            </div>

            <div className="grid gap-4">
              {[
                [
                  "Step 1",
                  "Create company",
                  "Set the company name your team will use for deals, collections, and buyer communication.",
                ],
                [
                  "Step 2",
                  "Confirm first admin",
                  "Use your current sign-in and set the operator details that should own the workspace.",
                ],
                [
                  "Step 3",
                  "Choose how to start",
                  "Open a clean workspace or load a realistic sample pipeline to see the product working immediately.",
                ],
              ].map(([eyebrow, title, body]) => (
                <div
                  key={title}
                  className="rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] p-5"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
                    {eyebrow}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--ink-950)]">{title}</div>
                  <div className="mt-1 text-sm leading-7 text-[var(--ink-600)]">{body}</div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white p-5">
              <div className="text-sm font-semibold text-[var(--ink-950)]">You can change this later</div>
              <div className="mt-1 text-sm leading-7 text-[var(--ink-600)]">
                Company details, branding, and sample data choices do not lock your workspace. The
                goal is to get you productive fast.
              </div>
            </div>

            {showDevShortcut ? (
              <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white p-5">
                <div className="text-sm font-semibold text-[var(--ink-950)]">Development shortcut</div>
                <div className="mt-1 text-sm leading-7 text-[var(--ink-600)]">
                  Spin up a realistic developer company with sample deals and payment states instantly.
                </div>
                <div className="mt-4">
                  <DevCreateCompanyButton />
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-8 sm:p-10">
          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
                Company setup
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Company name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  required
                />
                <div className="text-xs text-[var(--ink-500)]">
                  {submitted && !companyName.trim()
                    ? "Enter the company name you want on deals, receipts, and team operations."
                    : "This becomes the company workspace your sales and finance team will operate from."}
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Optional slug"
                  value={companySlug}
                  onChange={(event) => setCompanySlug(slugify(event.target.value))}
                />
                <div className="text-xs text-[var(--ink-500)]">
                  {suggestedSlug
                    ? `Workspace URL hint: ${suggestedSlug}`
                    : "Leave slug empty to auto-generate one from your company name."}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
                First admin
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="First name"
                  value={adminFirstName}
                  onChange={(event) => setAdminFirstName(event.target.value)}
                />
                <Input
                  placeholder="Last name"
                  value={adminLastName}
                  onChange={(event) => setAdminLastName(event.target.value)}
                />
              </div>
              <Input
                type="email"
                placeholder="Admin email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
              />
              <div className="text-xs text-[var(--ink-500)]">
                We will attach this admin to the new workspace and take them directly to the Deal Board.
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
                How do you want to start?
              </div>
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setIncludeSampleData(true)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    includeSampleData
                      ? "border-[var(--brand-600)] bg-[var(--sand-50)] shadow-[0_12px_36px_rgba(15,23,42,0.08)]"
                      : "border-[var(--line)] bg-white hover:border-[var(--brand-300)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--ink-950)]">
                        Start with sample workspace
                      </div>
                      <div className="mt-1 text-sm leading-7 text-[var(--ink-600)]">
                        Recommended if you want instant value. We will add a realistic property,
                        marketer, and live-looking deals including paid, pending, and overdue states.
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        includeSampleData
                          ? "bg-[var(--brand-700)] text-white"
                          : "bg-[var(--sand-100)] text-[var(--ink-600)]"
                      }`}
                    >
                      Recommended
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeSampleData(false)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    !includeSampleData
                      ? "border-[var(--brand-600)] bg-[var(--sand-50)] shadow-[0_12px_36px_rgba(15,23,42,0.08)]"
                      : "border-[var(--line)] bg-white hover:border-[var(--brand-300)]"
                  }`}
                >
                  <div className="text-sm font-semibold text-[var(--ink-950)]">Start clean</div>
                  <div className="mt-1 text-sm leading-7 text-[var(--ink-600)]">
                    Open an empty workspace with guided onboarding inside the Deal Board. You can
                    load a sample workspace later if you want to see the full flow.
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] p-5">
              <div className="text-sm font-semibold text-[var(--ink-950)]">What we will create</div>
              <div className="mt-2 grid gap-2 text-sm leading-7 text-[var(--ink-600)] sm:grid-cols-2">
                <div>Company workspace</div>
                <div>Default branch</div>
                <div>First admin seat</div>
                <div>{includeSampleData ? "Sample pipeline data" : "Clean Deal Board setup"}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Creating workspace..." : "Create workspace"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/platform")}>
                Back to platform site
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
