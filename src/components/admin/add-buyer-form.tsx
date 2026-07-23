"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ProvisionResultDialog } from "@/components/admin/provision-result-modal";
import { provisionBuyerAction } from "@/modules/provisioning/actions";
import type { ProvisionUserResult } from "@/modules/provisioning/provision-user";

const INITIAL: ProvisionUserResult | null = null;

const inputCls =
  "admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]";

const labelCls = "block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-500)]";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * "Add buyer" button + dialog for the front-desk surface.
 * The STAFF actor is restricted to BUYER role server-side; the form reflects that.
 * `hasClerkPassword` is read server-side and passed as a prop so the UI never
 * conditionally reveals the password option without server confirmation.
 */
export function AddBuyerButton({ hasClerkPassword }: { hasClerkPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [state, formAction] = useActionState(provisionBuyerAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // When a submission succeeds, reset form state (result dialog takes over)
  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    const id = setTimeout(() => setShowProfile(false), 0);
    return () => clearTimeout(id);
  }, [state?.ok]);

  function handleClose() {
    setOpen(false);
    setShowProfile(false);
  }

  function handleResultClose() {
    // Reset action state by closing and reopening the dialog won't work, but
    // we simply close everything — the result has been shown.
    handleClose();
  }

  if (state?.ok) {
    return (
      <ProvisionResultDialog
        result={state}
        onClose={handleResultClose}
      />
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden />
        Add buyer
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title="Add buyer account"
        description="Create a buyer login for a walk-in client. An invitation link will be sent to their email."
        size="lg"
      >
        <form ref={formRef} action={formAction} className="space-y-5">
          {/* Identity */}
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`${labelCls} col-span-2 mb-1`}>Identity</legend>
            <div>
              <label htmlFor="buyer-firstName" className={labelCls}>
                First name <span aria-hidden className="text-[var(--danger-600)]">*</span>
              </label>
              <input id="buyer-firstName" name="firstName" required className={`${inputCls} mt-1`} autoComplete="given-name" />
            </div>
            <div>
              <label htmlFor="buyer-lastName" className={labelCls}>
                Last name <span aria-hidden className="text-[var(--danger-600)]">*</span>
              </label>
              <input id="buyer-lastName" name="lastName" required className={`${inputCls} mt-1`} autoComplete="family-name" />
            </div>
            <div>
              <label htmlFor="buyer-email" className={labelCls}>
                Email <span aria-hidden className="text-[var(--danger-600)]">*</span>
              </label>
              <input id="buyer-email" name="email" type="email" required className={`${inputCls} mt-1`} autoComplete="email" />
            </div>
            <div>
              <label htmlFor="buyer-phone" className={labelCls}>Phone</label>
              <input id="buyer-phone" name="phone" type="tel" className={`${inputCls} mt-1`} autoComplete="tel" />
            </div>
          </fieldset>

          {/* Optional buyer profile */}
          <div>
            <button
              type="button"
              className="admin-focus text-xs font-medium text-[var(--brand-700)] hover:underline"
              onClick={() => {
                const id = setTimeout(() => setShowProfile((v) => !v), 0);
                return () => clearTimeout(id);
              }}
            >
              {showProfile ? "− Hide profile fields" : "+ Add profile details (optional)"}
            </button>

            {showProfile ? (
              <fieldset className="mt-3 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] p-4 sm:grid-cols-2">
                <legend className={`${labelCls} col-span-2 mb-1`}>Profile details</legend>
                <div>
                  <label htmlFor="buyer-addressLine1" className={labelCls}>Address line 1</label>
                  <input id="buyer-addressLine1" name="addressLine1" className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label htmlFor="buyer-addressLine2" className={labelCls}>Address line 2</label>
                  <input id="buyer-addressLine2" name="addressLine2" className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label htmlFor="buyer-city" className={labelCls}>City</label>
                  <input id="buyer-city" name="city" className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label htmlFor="buyer-state" className={labelCls}>State</label>
                  <input id="buyer-state" name="state" className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label htmlFor="buyer-occupation" className={labelCls}>Occupation</label>
                  <input id="buyer-occupation" name="occupation" className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label htmlFor="buyer-nextOfKinName" className={labelCls}>Next of kin name</label>
                  <input id="buyer-nextOfKinName" name="nextOfKinName" className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label htmlFor="buyer-nextOfKinPhone" className={labelCls}>Next of kin phone</label>
                  <input id="buyer-nextOfKinPhone" name="nextOfKinPhone" type="tel" className={`${inputCls} mt-1`} />
                </div>
              </fieldset>
            ) : null}
          </div>

          {/* Delivery choice */}
          {hasClerkPassword ? (
            <fieldset>
              <legend className={`${labelCls} mb-2`}>Account delivery</legend>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="radio" name="delivery" value="invite" defaultChecked className="mt-0.5" />
                  <span className="text-sm text-[var(--ink-700)]">
                    <span className="font-medium">Send invitation link</span>
                    <span className="block text-xs text-[var(--ink-500)]">
                      Buyer sets their own password on first sign-in. Recommended.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="radio" name="delivery" value="password" className="mt-0.5" />
                  <span className="text-sm text-[var(--ink-700)]">
                    <span className="font-medium">Generate temporary password</span>
                    <span className="block text-xs text-[var(--ink-500)]">
                      Shown once. Must be handed to the buyer in person. They will be required to change it.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          ) : (
            <input type="hidden" name="delivery" value="invite" />
          )}

          {state && !state.ok ? (
            <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--danger-50,#fef2f2)] px-4 py-2.5 text-sm text-[var(--danger-700,#b91c1c)]">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <SubmitButton label="Create buyer account" />
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
