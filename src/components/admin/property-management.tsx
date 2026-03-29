"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AdminPropertyManagementRecord } from "@/modules/properties/admin-queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type PropertyFormState = {
  title: string;
  shortDescription: string;
  description: string;
  propertyType: string;
  status: string;
  isFeatured: boolean;
  priceFrom: string;
  priceTo: string;
  currency: string;
  bedrooms: string;
  bathrooms: string;
  parkingSpaces: string;
  sizeSqm: string;
  brochureDocumentId: string;
  videoUrl: string;
  locationSummary: string;
  landmarks: string;
  hasPaymentPlan: boolean;
  location: {
    addressLine1: string;
    city: string;
    state: string;
    country: string;
    latitude: string;
    longitude: string;
    neighborhood: string;
    postalCode: string;
  };
  features: Array<{ label: string; value: string }>;
  media: Array<{
    id?: string;
    title: string;
    url: string;
    mimeType: string;
    sortOrder: string;
    isPrimary: boolean;
    visibility: "PUBLIC" | "PRIVATE";
  }>;
  units: Array<{
    id?: string;
    unitCode: string;
    title: string;
    status: string;
    price: string;
    bedrooms: string;
    bathrooms: string;
    sizeSqm: string;
    floor: string;
    block: string;
  }>;
  paymentPlans: Array<{
    id?: string;
    propertyUnitId: string;
    title: string;
    kind: "ONE_TIME" | "FIXED" | "CUSTOM";
    description: string;
    scheduleDescription: string;
    durationMonths: string;
    installmentCount: string;
    depositPercent: string;
    downPaymentAmount: string;
    isActive: boolean;
    installments: Array<{
      id?: string;
      title: string;
      amount: string;
      dueInDays: string;
      scheduleLabel: string;
      sortOrder: string;
    }>;
  }>;
};

function emptyFormState(): PropertyFormState {
  return {
    title: "",
    shortDescription: "",
    description: "",
    propertyType: "APARTMENT",
    status: "DRAFT",
    isFeatured: false,
    priceFrom: "",
    priceTo: "",
    currency: "NGN",
    bedrooms: "",
    bathrooms: "",
    parkingSpaces: "",
    sizeSqm: "",
    brochureDocumentId: "",
    videoUrl: "",
    locationSummary: "",
    landmarks: "",
    hasPaymentPlan: false,
    location: {
      addressLine1: "",
      city: "",
      state: "",
      country: "Nigeria",
      latitude: "",
      longitude: "",
      neighborhood: "",
      postalCode: "",
    },
    features: [{ label: "", value: "" }],
    media: [{ title: "", url: "", mimeType: "", sortOrder: "0", isPrimary: true, visibility: "PUBLIC" }],
    units: [{ unitCode: "", title: "", status: "AVAILABLE", price: "", bedrooms: "", bathrooms: "", sizeSqm: "", floor: "", block: "" }],
    paymentPlans: [],
  };
}

function toFormState(property: AdminPropertyManagementRecord): PropertyFormState {
  return {
    title: property.title,
    shortDescription: property.shortDescription,
    description: property.description,
    propertyType: property.propertyType,
    status: property.status,
    isFeatured: property.isFeatured,
    priceFrom: String(property.priceFrom),
    priceTo: property.priceTo == null ? "" : String(property.priceTo),
    currency: property.currency,
    bedrooms: property.bedrooms == null ? "" : String(property.bedrooms),
    bathrooms: property.bathrooms == null ? "" : String(property.bathrooms),
    parkingSpaces: property.parkingSpaces == null ? "" : String(property.parkingSpaces),
    sizeSqm: property.sizeSqm == null ? "" : String(property.sizeSqm),
    brochureDocumentId: property.brochureDocumentId ?? "",
    videoUrl: property.videoUrl ?? "",
    locationSummary: property.locationSummary ?? "",
    landmarks: property.landmarks.join(", "),
    hasPaymentPlan: property.hasPaymentPlan,
    location: {
      addressLine1: property.location.addressLine1 ?? "",
      city: property.location.city,
      state: property.location.state,
      country: property.location.country,
      latitude: property.location.latitude == null ? "" : String(property.location.latitude),
      longitude: property.location.longitude == null ? "" : String(property.location.longitude),
      neighborhood: property.location.neighborhood ?? "",
      postalCode: property.location.postalCode ?? "",
    },
    features:
      property.features.length > 0
        ? property.features.map((feature) => ({
            label: feature.label,
            value: feature.value ?? "",
          }))
        : [{ label: "", value: "" }],
    media:
      property.media.length > 0
        ? property.media.map((item) => ({
            id: item.id,
            title: item.title ?? "",
            url: item.url,
            mimeType: item.mimeType ?? "",
            sortOrder: String(item.sortOrder),
            isPrimary: item.isPrimary,
            visibility: item.visibility as "PUBLIC" | "PRIVATE",
          }))
        : [{ title: "", url: "", mimeType: "", sortOrder: "0", isPrimary: true, visibility: "PUBLIC" }],
    units:
      property.units.length > 0
        ? property.units.map((unit) => ({
            id: unit.id,
            unitCode: unit.unitCode,
            title: unit.title,
            status: unit.status,
            price: String(unit.price),
            bedrooms: unit.bedrooms == null ? "" : String(unit.bedrooms),
            bathrooms: unit.bathrooms == null ? "" : String(unit.bathrooms),
            sizeSqm: unit.sizeSqm == null ? "" : String(unit.sizeSqm),
            floor: unit.floor == null ? "" : String(unit.floor),
            block: unit.block ?? "",
          }))
        : [{ unitCode: "", title: "", status: "AVAILABLE", price: "", bedrooms: "", bathrooms: "", sizeSqm: "", floor: "", block: "" }],
    paymentPlans: property.paymentPlans.map((plan) => ({
      id: plan.id,
      propertyUnitId: plan.propertyUnitId ?? "",
      title: plan.title,
      kind: plan.kind as "ONE_TIME" | "FIXED" | "CUSTOM",
      description: plan.description ?? "",
      scheduleDescription: plan.scheduleDescription ?? "",
      durationMonths: String(plan.durationMonths),
      installmentCount: plan.installmentCount == null ? "" : String(plan.installmentCount),
      depositPercent: plan.depositPercent == null ? "" : String(plan.depositPercent),
      downPaymentAmount: plan.downPaymentAmount == null ? "" : String(plan.downPaymentAmount),
      isActive: plan.isActive,
      installments: plan.installments.map((installment) => ({
        id: installment.id,
        title: installment.title,
        amount: String(installment.amount),
        dueInDays: String(installment.dueInDays),
        scheduleLabel: installment.scheduleLabel ?? "",
        sortOrder: String(installment.sortOrder),
      })),
    })),
  };
}

function serializeForm(state: PropertyFormState) {
  return {
    title: state.title,
    shortDescription: state.shortDescription,
    description: state.description,
    propertyType: state.propertyType,
    status: state.status,
    isFeatured: state.isFeatured,
    priceFrom: Number(state.priceFrom),
    priceTo: state.priceTo ? Number(state.priceTo) : undefined,
    currency: state.currency,
    bedrooms: state.bedrooms ? Number(state.bedrooms) : undefined,
    bathrooms: state.bathrooms ? Number(state.bathrooms) : undefined,
    parkingSpaces: state.parkingSpaces ? Number(state.parkingSpaces) : undefined,
    sizeSqm: state.sizeSqm ? Number(state.sizeSqm) : undefined,
    brochureDocumentId: state.brochureDocumentId || undefined,
    videoUrl: state.videoUrl || undefined,
    locationSummary: state.locationSummary || undefined,
    landmarks: state.landmarks
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    hasPaymentPlan: state.hasPaymentPlan,
    location: {
      addressLine1: state.location.addressLine1 || undefined,
      city: state.location.city,
      state: state.location.state,
      country: state.location.country,
      latitude: state.location.latitude ? Number(state.location.latitude) : undefined,
      longitude: state.location.longitude ? Number(state.location.longitude) : undefined,
      neighborhood: state.location.neighborhood || undefined,
      postalCode: state.location.postalCode || undefined,
    },
    features: state.features
      .filter((feature) => feature.label.trim())
      .map((feature) => ({
        label: feature.label,
        value: feature.value || undefined,
      })),
    media: state.media
      .filter((item) => item.url.trim())
      .map((item, index) => ({
        id: item.id,
        title: item.title || undefined,
        url: item.url,
        mimeType: item.mimeType || undefined,
        sortOrder: Number(item.sortOrder || index),
        isPrimary: item.isPrimary,
        visibility: item.visibility,
      })),
    units: state.units
      .filter((unit) => unit.unitCode.trim() && unit.title.trim() && unit.price.trim())
      .map((unit) => ({
        id: unit.id,
        unitCode: unit.unitCode,
        title: unit.title,
        status: unit.status,
        price: Number(unit.price),
        bedrooms: unit.bedrooms ? Number(unit.bedrooms) : undefined,
        bathrooms: unit.bathrooms ? Number(unit.bathrooms) : undefined,
        sizeSqm: unit.sizeSqm ? Number(unit.sizeSqm) : undefined,
        floor: unit.floor ? Number(unit.floor) : undefined,
        block: unit.block || undefined,
      })),
    paymentPlans: state.paymentPlans
      .filter((plan) => plan.title.trim())
      .map((plan) => ({
        id: plan.id,
        propertyUnitId: plan.propertyUnitId || undefined,
        title: plan.title,
        kind: plan.kind,
        description: plan.description || undefined,
        scheduleDescription: plan.scheduleDescription || undefined,
        durationMonths: Number(plan.durationMonths || 0),
        installmentCount: plan.installmentCount ? Number(plan.installmentCount) : undefined,
        depositPercent: plan.depositPercent ? Number(plan.depositPercent) : undefined,
        downPaymentAmount: plan.downPaymentAmount ? Number(plan.downPaymentAmount) : undefined,
        isActive: plan.isActive,
        installments: plan.installments
          .filter((installment) => installment.title.trim() && installment.amount.trim())
          .map((installment, index) => ({
            id: installment.id,
            title: installment.title,
            amount: Number(installment.amount),
            dueInDays: Number(installment.dueInDays || 0),
            scheduleLabel: installment.scheduleLabel || undefined,
            sortOrder: Number(installment.sortOrder || index),
          })),
      })),
  };
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--ink-950)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--ink-500)]">{description}</p>
    </div>
  );
}

export function PropertyManagement({
  properties,
  brochures,
}: {
  properties: AdminPropertyManagementRecord[];
  brochures: Array<{ id: string; fileName: string }>;
}) {
  const router = useRouter();
  const [createState, setCreateState] = useState<PropertyFormState>(emptyFormState());
  const [editingId, setEditingId] = useState<string | null>(properties[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, PropertyFormState>>(
    Object.fromEntries(properties.map((property) => [property.id, toFormState(property)])),
  );
  const [pending, setPending] = useState<string | null>(null);

  const editingProperty = useMemo(
    () => (editingId ? properties.find((property) => property.id === editingId) ?? null : null),
    [editingId, properties],
  );

  function updateDraft(
    propertyId: string,
    updater: (current: PropertyFormState) => PropertyFormState,
  ) {
    setDrafts((current) => ({
      ...current,
      [propertyId]: updater(current[propertyId] ?? emptyFormState()),
    }));
  }

  async function submitCreate() {
    setPending("create");
    const response = await fetch("/api/admin/properties", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serializeForm(createState)),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to create property.");
      return;
    }

    toast.success("Property created.");
    setCreateState(emptyFormState());
    router.refresh();
  }

  async function submitUpdate(propertyId: string) {
    setPending(propertyId);
    const response = await fetch(`/api/admin/properties/${propertyId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serializeForm(drafts[propertyId])),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update property.");
      return;
    }

    toast.success("Property updated.");
    router.refresh();
  }

  async function updateStatus(propertyId: string, status: string) {
    setPending(`${propertyId}:${status}`);
    const response = await fetch(`/api/admin/properties/${propertyId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update property status.");
      return;
    }

    toast.success(`Property moved to ${status.toLowerCase()}.`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <SectionTitle
            title="Create property"
            description="Add a new listing or project with unit, media, and publication details."
          />
          <Badge>Tenant-safe</Badge>
        </div>
        <PropertyEditor
          value={createState}
          brochures={brochures}
          onChange={setCreateState}
          onSubmit={submitCreate}
          submitLabel={pending === "create" ? "Creating..." : "Create property"}
          disabled={pending === "create"}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.38fr_0.62fr]">
        <Card className="p-6">
          <SectionTitle
            title="Existing inventory"
            description="Select a listing to adjust inventory, media, and publishing state."
          />
          <div className="mt-5 space-y-3">
            {properties.map((property) => (
              <button
                key={property.id}
                type="button"
                onClick={() => setEditingId(property.id)}
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  editingId === property.id
                    ? "border-[var(--brand-500)] bg-[var(--sand-100)]"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[var(--ink-950)]">{property.title}</div>
                    <div className="mt-1 text-sm text-[var(--ink-500)]">{property.location.city}, {property.location.state}</div>
                  </div>
                  <Badge>{property.status.toLowerCase()}</Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          {editingProperty && editingId ? (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <SectionTitle
                  title={`Edit ${editingProperty.title}`}
                  description="Persist real changes to copy, pricing, units, media, and public status."
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(editingId, "DRAFT")}
                    disabled={pending === `${editingId}:DRAFT`}
                  >
                    Unpublish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(editingId, "AVAILABLE")}
                    disabled={pending === `${editingId}:AVAILABLE`}
                  >
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(editingId, "ARCHIVED")}
                    disabled={pending === `${editingId}:ARCHIVED`}
                  >
                    Archive
                  </Button>
                </div>
              </div>
              <PropertyEditor
                value={drafts[editingId] ?? toFormState(editingProperty)}
                brochures={brochures}
                onChange={(next) => updateDraft(editingId, () => next)}
                onSubmit={() => submitUpdate(editingId)}
                submitLabel={pending === editingId ? "Saving..." : "Save changes"}
                disabled={pending === editingId}
              />
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--ink-500)]">
              Select a property to start editing.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PropertyEditor({
  value,
  brochures,
  onChange,
  onSubmit,
  submitLabel,
  disabled,
}: {
  value: PropertyFormState;
  brochures: Array<{ id: string; fileName: string }>;
  onChange: (next: PropertyFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  function update<K extends keyof PropertyFormState>(key: K, nextValue: PropertyFormState[K]) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Input placeholder="Title" value={value.title} onChange={(event) => update("title", event.target.value)} />
        <select
          className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
          value={value.propertyType}
          onChange={(event) => update("propertyType", event.target.value)}
        >
          <option value="APARTMENT">Apartment</option>
          <option value="DUPLEX">Duplex</option>
          <option value="TERRACE">Terrace</option>
          <option value="DETACHED">Detached</option>
          <option value="SEMI_DETACHED">Semi-detached</option>
          <option value="LAND">Land</option>
          <option value="COMMERCIAL">Commercial</option>
        </select>
        <Input
          placeholder="Short description"
          value={value.shortDescription}
          onChange={(event) => update("shortDescription", event.target.value)}
        />
        <Input
          placeholder="Location summary"
          value={value.locationSummary}
          onChange={(event) => update("locationSummary", event.target.value)}
        />
      </div>

      <Textarea
        placeholder="Long description"
        value={value.description}
        onChange={(event) => update("description", event.target.value)}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Input placeholder="Price from" value={value.priceFrom} onChange={(event) => update("priceFrom", event.target.value)} />
        <Input placeholder="Price to" value={value.priceTo} onChange={(event) => update("priceTo", event.target.value)} />
        <Input placeholder="Bedrooms" value={value.bedrooms} onChange={(event) => update("bedrooms", event.target.value)} />
        <Input placeholder="Bathrooms" value={value.bathrooms} onChange={(event) => update("bathrooms", event.target.value)} />
        <Input placeholder="Parking spaces" value={value.parkingSpaces} onChange={(event) => update("parkingSpaces", event.target.value)} />
        <Input placeholder="Size (sqm)" value={value.sizeSqm} onChange={(event) => update("sizeSqm", event.target.value)} />
        <Input placeholder="Video walkthrough URL" value={value.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} />
        <select
          className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
          value={value.brochureDocumentId}
          onChange={(event) => update("brochureDocumentId", event.target.value)}
        >
          <option value="">No brochure linked</option>
          {brochures.map((brochure) => (
            <option key={brochure.id} value={brochure.id}>
              {brochure.fileName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input placeholder="Address line 1" value={value.location.addressLine1} onChange={(event) => update("location", { ...value.location, addressLine1: event.target.value })} />
        <Input placeholder="Neighborhood" value={value.location.neighborhood} onChange={(event) => update("location", { ...value.location, neighborhood: event.target.value })} />
        <Input placeholder="City" value={value.location.city} onChange={(event) => update("location", { ...value.location, city: event.target.value })} />
        <Input placeholder="State" value={value.location.state} onChange={(event) => update("location", { ...value.location, state: event.target.value })} />
        <Input placeholder="Country" value={value.location.country} onChange={(event) => update("location", { ...value.location, country: event.target.value })} />
        <Input placeholder="Postal code" value={value.location.postalCode} onChange={(event) => update("location", { ...value.location, postalCode: event.target.value })} />
        <Input placeholder="Latitude" value={value.location.latitude} onChange={(event) => update("location", { ...value.location, latitude: event.target.value })} />
        <Input placeholder="Longitude" value={value.location.longitude} onChange={(event) => update("location", { ...value.location, longitude: event.target.value })} />
      </div>

      <Textarea
        placeholder="Nearby landmarks, comma separated"
        value={value.landmarks}
        onChange={(event) => update("landmarks", event.target.value)}
      />

      <ArraySection title="Features" onAdd={() => update("features", [...value.features, { label: "", value: "" }])}>
        {value.features.map((feature, index) => (
          <div key={`feature-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder="Feature label"
              value={feature.label}
              onChange={(event) =>
                update("features", value.features.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))
              }
            />
            <Input
              placeholder="Feature value"
              value={feature.value}
              onChange={(event) =>
                update("features", value.features.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))
              }
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => update("features", value.features.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
      </ArraySection>

      <ArraySection title="Media" onAdd={() => update("media", [...value.media, { title: "", url: "", mimeType: "", sortOrder: String(value.media.length), isPrimary: false, visibility: "PUBLIC" }])}>
        {value.media.map((media, index) => (
          <div key={`media-${index}`} className="grid gap-3 rounded-3xl border border-[var(--line)] p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Media title"
                value={media.title}
                onChange={(event) =>
                  update("media", value.media.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))
                }
              />
              <Input
                placeholder="Media URL"
                value={media.url}
                onChange={(event) =>
                  update("media", value.media.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))
                }
              />
              <Input
                placeholder="MIME type"
                value={media.mimeType}
                onChange={(event) =>
                  update("media", value.media.map((item, itemIndex) => itemIndex === index ? { ...item, mimeType: event.target.value } : item))
                }
              />
              <Input
                placeholder="Sort order"
                value={media.sortOrder}
                onChange={(event) =>
                  update("media", value.media.map((item, itemIndex) => itemIndex === index ? { ...item, sortOrder: event.target.value } : item))
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
                <input
                  type="checkbox"
                  checked={media.isPrimary}
                  onChange={(event) =>
                    update(
                      "media",
                      value.media.map((item, itemIndex) => ({
                        ...item,
                        isPrimary: itemIndex === index ? event.target.checked : false,
                      })),
                    )
                  }
                />
                Primary image
              </label>
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={media.visibility}
                onChange={(event) =>
                  update("media", value.media.map((item, itemIndex) => itemIndex === index ? { ...item, visibility: event.target.value as "PUBLIC" | "PRIVATE" } : item))
                }
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
              <Button type="button" variant="outline" onClick={() => update("media", value.media.filter((_, itemIndex) => itemIndex !== index))}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </ArraySection>

      <ArraySection title="Units" onAdd={() => update("units", [...value.units, { unitCode: "", title: "", status: "AVAILABLE", price: "", bedrooms: "", bathrooms: "", sizeSqm: "", floor: "", block: "" }])}>
        {value.units.map((unit, index) => (
          <div key={`unit-${index}`} className="grid gap-3 rounded-3xl border border-[var(--line)] p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Unit code" value={unit.unitCode} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, unitCode: event.target.value } : item))} />
              <Input placeholder="Unit title" value={unit.title} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} />
              <Input placeholder="Price" value={unit.price} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, price: event.target.value } : item))} />
              <Input placeholder="Bedrooms" value={unit.bedrooms} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, bedrooms: event.target.value } : item))} />
              <Input placeholder="Bathrooms" value={unit.bathrooms} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, bathrooms: event.target.value } : item))} />
              <Input placeholder="Size sqm" value={unit.sizeSqm} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, sizeSqm: event.target.value } : item))} />
              <Input placeholder="Floor" value={unit.floor} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, floor: event.target.value } : item))} />
              <Input placeholder="Block" value={unit.block} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, block: event.target.value } : item))} />
              <select className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={unit.status} onChange={(event) => update("units", value.units.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value } : item))}>
                <option value="AVAILABLE">Available</option>
                <option value="RESERVED">Reserved</option>
                <option value="SOLD">Sold</option>
                <option value="ARCHIVED">Archived</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
            <div>
              <Button type="button" variant="outline" onClick={() => update("units", value.units.filter((_, itemIndex) => itemIndex !== index))}>
                Remove unit
              </Button>
            </div>
          </div>
        ))}
      </ArraySection>

      <ArraySection
        title="Payment plans"
        onAdd={() =>
          update("paymentPlans", [
            ...value.paymentPlans,
            {
              title: "",
              propertyUnitId: "",
              kind: "FIXED",
              description: "",
              scheduleDescription: "",
              durationMonths: "0",
              installmentCount: "",
              depositPercent: "",
              downPaymentAmount: "",
              isActive: true,
              installments: [
                { title: "", amount: "", dueInDays: "0", scheduleLabel: "", sortOrder: "0" },
              ],
            },
          ])
        }
      >
        {value.paymentPlans.map((plan, index) => (
          <div key={`plan-${index}`} className="grid gap-3 rounded-3xl border border-[var(--line)] p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Plan title"
                value={plan.title}
                onChange={(event) =>
                  update(
                    "paymentPlans",
                    value.paymentPlans.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, title: event.target.value } : item,
                    ),
                  )
                }
              />
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={plan.kind}
                onChange={(event) =>
                  update(
                    "paymentPlans",
                    value.paymentPlans.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, kind: event.target.value as "ONE_TIME" | "FIXED" | "CUSTOM" }
                        : item,
                    ),
                  )
                }
              >
                <option value="ONE_TIME">One time</option>
                <option value="FIXED">Fixed installments</option>
                <option value="CUSTOM">Custom plan</option>
              </select>
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={plan.propertyUnitId}
                onChange={(event) =>
                  update(
                    "paymentPlans",
                    value.paymentPlans.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, propertyUnitId: event.target.value } : item,
                    ),
                  )
                }
              >
                <option value="">Applies to full property</option>
                {value.units
                  .filter((unit) => unit.unitCode.trim())
                  .map((unit) => (
                    <option key={unit.id ?? unit.unitCode} value={unit.id ?? ""}>
                      {unit.title || unit.unitCode}
                    </option>
                  ))}
              </select>
              <Input
                placeholder="Duration (months)"
                value={plan.durationMonths}
                onChange={(event) =>
                  update(
                    "paymentPlans",
                    value.paymentPlans.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, durationMonths: event.target.value } : item,
                    ),
                  )
                }
              />
              <Input
                placeholder="Installment count"
                value={plan.installmentCount}
                onChange={(event) =>
                  update(
                    "paymentPlans",
                    value.paymentPlans.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, installmentCount: event.target.value } : item,
                    ),
                  )
                }
              />
              <Input
                placeholder="Deposit %"
                value={plan.depositPercent}
                onChange={(event) =>
                  update(
                    "paymentPlans",
                    value.paymentPlans.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, depositPercent: event.target.value } : item,
                    ),
                  )
                }
              />
              <Input
                placeholder="Down payment amount"
                value={plan.downPaymentAmount}
                onChange={(event) =>
                  update(
                    "paymentPlans",
                    value.paymentPlans.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, downPaymentAmount: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
            <Textarea
              placeholder="Plan description"
              value={plan.description}
              onChange={(event) =>
                update(
                  "paymentPlans",
                  value.paymentPlans.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, description: event.target.value } : item,
                  ),
                )
              }
            />
            <Textarea
              placeholder="Schedule description"
              value={plan.scheduleDescription}
              onChange={(event) =>
                update(
                  "paymentPlans",
                  value.paymentPlans.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, scheduleDescription: event.target.value } : item,
                  ),
                )
              }
            />
            <ArraySection
              title="Installments"
              onAdd={() =>
                update(
                  "paymentPlans",
                  value.paymentPlans.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          installments: [
                            ...item.installments,
                            {
                              title: "",
                              amount: "",
                              dueInDays: "0",
                              scheduleLabel: "",
                              sortOrder: String(item.installments.length),
                            },
                          ],
                        }
                      : item,
                  ),
                )
              }
            >
              {plan.installments.map((installment, installmentIndex) => (
                <div
                  key={`plan-${index}-installment-${installmentIndex}`}
                  className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
                >
                  <Input
                    placeholder="Installment title"
                    value={installment.title}
                    onChange={(event) =>
                      update(
                        "paymentPlans",
                        value.paymentPlans.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                installments: item.installments.map((entry, entryIndex) =>
                                  entryIndex === installmentIndex
                                    ? { ...entry, title: event.target.value }
                                    : entry,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Amount"
                    value={installment.amount}
                    onChange={(event) =>
                      update(
                        "paymentPlans",
                        value.paymentPlans.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                installments: item.installments.map((entry, entryIndex) =>
                                  entryIndex === installmentIndex
                                    ? { ...entry, amount: event.target.value }
                                    : entry,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Due in days"
                    value={installment.dueInDays}
                    onChange={(event) =>
                      update(
                        "paymentPlans",
                        value.paymentPlans.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                installments: item.installments.map((entry, entryIndex) =>
                                  entryIndex === installmentIndex
                                    ? { ...entry, dueInDays: event.target.value }
                                    : entry,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Schedule label"
                    value={installment.scheduleLabel}
                    onChange={(event) =>
                      update(
                        "paymentPlans",
                        value.paymentPlans.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                installments: item.installments.map((entry, entryIndex) =>
                                  entryIndex === installmentIndex
                                    ? { ...entry, scheduleLabel: event.target.value }
                                    : entry,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      update(
                        "paymentPlans",
                        value.paymentPlans.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                installments: item.installments.filter(
                                  (_, entryIndex) => entryIndex !== installmentIndex,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </ArraySection>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
                <input
                  type="checkbox"
                  checked={plan.isActive}
                  onChange={(event) =>
                    update(
                      "paymentPlans",
                      value.paymentPlans.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, isActive: event.target.checked } : item,
                      ),
                    )
                  }
                />
                Active plan
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  update(
                    "paymentPlans",
                    value.paymentPlans.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                Remove plan
              </Button>
            </div>
          </div>
        ))}
      </ArraySection>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.isFeatured}
            onChange={(event) => update("isFeatured", event.target.checked)}
          />
          Featured listing
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.hasPaymentPlan}
            onChange={(event) => update("hasPaymentPlan", event.target.checked)}
          />
          Payment plan available
        </label>
        <select
          className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
          value={value.status}
          onChange={(event) => update("status", event.target.value)}
        >
          <option value="DRAFT">Draft</option>
          <option value="AVAILABLE">Available</option>
          <option value="RESERVED">Reserved</option>
          <option value="SOLD">Sold</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Button type="button" onClick={onSubmit} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function ArraySection({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle title={title} description={`Manage ${title.toLowerCase()} for this listing.`} />
        <Button type="button" variant="outline" onClick={onAdd}>
          Add
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
