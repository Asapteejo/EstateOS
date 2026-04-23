"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UploadField } from "@/components/uploads/upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type BuyerProfileRecord = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profileImageUrl: string;
  dateOfBirth: string;
  nationality: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  occupation: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  profileCompleted: boolean;
};

export function ProfileForm({ initialValue }: { initialValue: BuyerProfileRecord }) {
  const router = useRouter();
  const [form, setForm] = useState(initialValue);
  const [pending, setPending] = useState(false);

  function update<K extends keyof BuyerProfileRecord>(key: K, value: BuyerProfileRecord[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit() {
    setPending(true);
    const response = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to save profile.");
      return;
    }

    toast.success("Profile saved.");
    router.refresh();
  }

  return (
    <Card className="grid gap-4 p-8 md:grid-cols-2">
      <div className="md:col-span-2">
        <UploadField
          label="Profile picture"
          purpose="BUYER_PROFILE_PHOTO"
          surface="portal"
          mode="publicAsset"
          allowExternalUrl
          helperText="Shown across your buyer workspace so sales and operations can identify your profile consistently."
          value={{ url: form.profileImageUrl }}
          onChange={(uploaded) => update("profileImageUrl", uploaded.url ?? "")}
        />
      </div>
      <Input placeholder="First name" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} />
      <Input placeholder="Last name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} />
      <Input placeholder="Email address" value={form.email} onChange={(event) => update("email", event.target.value)} />
      <Input placeholder="Phone number" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
      <Input type="date" placeholder="Date of birth" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} />
      <Input placeholder="Nationality" value={form.nationality} onChange={(event) => update("nationality", event.target.value)} />
      <Input placeholder="Address line 1" value={form.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} />
      <Input placeholder="Address line 2" value={form.addressLine2} onChange={(event) => update("addressLine2", event.target.value)} />
      <Input placeholder="City" value={form.city} onChange={(event) => update("city", event.target.value)} />
      <Input placeholder="State" value={form.state} onChange={(event) => update("state", event.target.value)} />
      <Input placeholder="Country" value={form.country} onChange={(event) => update("country", event.target.value)} />
      <Input placeholder="Occupation" value={form.occupation} onChange={(event) => update("occupation", event.target.value)} />
      <Input placeholder="Next of kin name" value={form.nextOfKinName} onChange={(event) => update("nextOfKinName", event.target.value)} />
      <Input placeholder="Next of kin phone" value={form.nextOfKinPhone} onChange={(event) => update("nextOfKinPhone", event.target.value)} />
      <div className="md:col-span-2 flex items-center justify-between gap-4">
        <div className="text-sm text-[var(--ink-500)]">
          {form.profileCompleted ? "Profile complete" : "Complete all fields used by legal and finance operations."}
        </div>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </Card>
  );
}
