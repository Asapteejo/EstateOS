"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AdminPropertyManagementRecord } from "@/modules/properties/admin-queries";
import { AdminEmptyState } from "@/components/admin/admin-ui";
import { PropertyLocationPicker } from "@/components/admin/property-location-picker";
import { MultiUploadDropzone } from "@/components/uploads/multi-upload-dropzone";
import { UploadField } from "@/components/uploads/upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseFlexibleNumber } from "@/lib/number";
import { SUPPORTED_CURRENCIES } from "@/lib/utils";

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
  landSizeSqm: string;
  numberOfPlots: string;
  landSaleUnit: string;
  hectares: string;
  acres: string;
  plotOptions: Array<{
    label: string;
    unit: string;
    sizeSqm: string;
    numberOfPlots: string;
    hectares: string;
    acres: string;
    price: string;
    currency: string;
    status: string;
    note: string;
  }>;
  brochureDocumentId: string;
  videoUrl: string;
  offerEndsAt: string;
  countdownLabel: string;
  countdownEnabled: boolean;
  locationSummary: string;
  landmarks: string;
  hasPaymentPlan: boolean;
  wishlistDurationDays: string;
  wishlistReminderEnabled: boolean;
  location: {
    addressLine1: string;
    formattedAddress: string;
    city: string;
    state: string;
    country: string;
    latitude: string;
    longitude: string;
    mapboxPlaceId: string;
    boundaryGeoJson: string;
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

type ValidationIssue = {
  path: string;
  message: string;
  code?: string;
};

type ApiErrorResponse = {
  error?: string;
  issues?: ValidationIssue[];
};

const LAND_OPTION_LABELS: Record<string, { button: string; empty: string }> = {
  SQM: {
    button: "Add SQM option",
    empty: "Optional. Add multiple SQM options like 350 sqm, 400 sqm, or 600 sqm.",
  },
  PLOT: {
    button: "Add plot option",
    empty: "Optional. Add plot options like 1 plot, 2 plots, or corner plots.",
  },
  HECTARE: {
    button: "Add hectare option",
    empty: "Optional. Add hectare options like 1 hectare or 2 hectares.",
  },
  ACRE: {
    button: "Add acre option",
    empty: "Optional. Add acre options like 1 acre or 5 acres.",
  },
  CUSTOM: {
    button: "Add custom option",
    empty: "Optional. Add custom options like corner piece or waterfront allocation.",
  },
};

function defaultLandOptionLabel(option: PropertyFormState["plotOptions"][number]) {
  if (option.label.trim()) {
    return option.label.trim();
  }

  if (option.unit === "SQM" && option.sizeSqm.trim()) {
    return `${option.sizeSqm.trim()} sqm`;
  }

  if (option.unit === "PLOT" && option.numberOfPlots.trim()) {
    const plots = option.numberOfPlots.trim();
    return `${plots} plot${plots === "1" ? "" : "s"}`;
  }

  if (option.unit === "HECTARE" && option.hectares.trim()) {
    const hectares = option.hectares.trim();
    return `${hectares} hectare${hectares === "1" ? "" : "s"}`;
  }

  if (option.unit === "ACRE" && option.acres.trim()) {
    const acres = option.acres.trim();
    return `${acres} acre${acres === "1" ? "" : "s"}`;
  }

  return undefined;
}

function newLandOption(unit: string, currency: string): PropertyFormState["plotOptions"][number] {
  return {
    label: "",
    unit,
    sizeSqm: "",
    numberOfPlots: "",
    hectares: "",
    acres: "",
    price: "",
    currency,
    status: "AVAILABLE",
    note: "",
  };
}

const PROPERTY_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  shortDescription: "Short description",
  description: "Description",
  propertyType: "Property type",
  status: "Status",
  priceFrom: "Price from",
  priceTo: "Price to",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  parkingSpaces: "Parking spaces",
  sizeSqm: "Size",
  landSizeSqm: "Land size",
  numberOfPlots: "Number of plots",
  landSaleUnit: "Primary land sale unit",
  hectares: "Hectares",
  acres: "Acres",
  plotOptions: "Plot options",
  offerEndsAt: "Offer end date",
  countdownLabel: "Countdown label",
  "location.addressLine1": "Address line 1",
  "location.formattedAddress": "Formatted address",
  "location.city": "City",
  "location.state": "State",
  "location.country": "Country",
  "location.latitude": "Latitude",
  "location.longitude": "Longitude",
  "location.mapboxPlaceId": "Mapbox place",
  "location.boundaryGeoJson": "Boundary",
  media: "Media",
  units: "Units",
  paymentPlans: "Payment plans",
};

function formatFieldLabel(path: string) {
  if (!path) {
    return "Property";
  }

  return PROPERTY_FIELD_LABELS[path] ?? path
    .replace(/\.(\d+)(?=\.|$)/g, " $1")
    .split(".")
    .map((part) => part.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()))
    .join(" ");
}

function formatValidationMessage(message: string) {
  const minStringMatch = message.match(/^Too small: expected string to have >=(\d+) characters$/);
  if (minStringMatch) {
    return `must be at least ${minStringMatch[1]} characters`;
  }

  const positiveNumberMatch = message.match(/^Too small: expected number to be >0$/);
  if (positiveNumberMatch) {
    return "must be greater than 0";
  }

  return message;
}

function formatApiError(json: ApiErrorResponse | null, fallback: string) {
  if (json?.issues?.length) {
    const firstIssue = json.issues[0];
    return `${formatFieldLabel(firstIssue.path)}: ${formatValidationMessage(firstIssue.message)}`;
  }

  return json?.error ?? fallback;
}

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
    landSizeSqm: "",
    numberOfPlots: "",
    landSaleUnit: "CUSTOM",
    hectares: "",
    acres: "",
    plotOptions: [],
    brochureDocumentId: "",
    videoUrl: "",
    offerEndsAt: "",
    countdownLabel: "Introductory price ends in",
    countdownEnabled: false,
    locationSummary: "",
    landmarks: "",
    hasPaymentPlan: false,
    wishlistDurationDays: "14",
    wishlistReminderEnabled: true,
    location: {
      addressLine1: "",
      formattedAddress: "",
      city: "",
      state: "",
      country: "Nigeria",
      latitude: "",
      longitude: "",
      mapboxPlaceId: "",
      boundaryGeoJson: "",
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
    landSizeSqm: property.landSizeSqm == null ? "" : String(property.landSizeSqm),
    numberOfPlots: property.numberOfPlots == null ? "" : String(property.numberOfPlots),
    landSaleUnit: property.landSaleUnit ?? "CUSTOM",
    hectares: property.hectares == null ? "" : String(property.hectares),
    acres: property.acres == null ? "" : String(property.acres),
    plotOptions: property.plotOptions.map((option) => ({
      label: option.label ?? "",
      unit: option.unit ?? "SQM",
      sizeSqm: option.sizeSqm == null ? "" : String(option.sizeSqm),
      numberOfPlots: option.numberOfPlots == null ? "" : String(option.numberOfPlots),
      hectares: option.hectares == null ? "" : String(option.hectares),
      acres: option.acres == null ? "" : String(option.acres),
      price: option.price == null ? "" : String(option.price),
      currency: option.currency ?? property.currency,
      status: option.status ?? "AVAILABLE",
      note: option.note ?? "",
    })),
    brochureDocumentId: property.brochureDocumentId ?? "",
    videoUrl: property.videoUrl ?? "",
    offerEndsAt: property.offerEndsAt ? property.offerEndsAt.slice(0, 16) : "",
    countdownLabel: property.countdownLabel ?? "Introductory price ends in",
    countdownEnabled: property.countdownEnabled,
    locationSummary: property.locationSummary ?? "",
    landmarks: property.landmarks.join(", "),
    hasPaymentPlan: property.hasPaymentPlan,
    wishlistDurationDays:
      property.wishlistDurationDays == null ? "" : String(property.wishlistDurationDays),
    wishlistReminderEnabled: property.wishlistReminderEnabled,
    location: {
      addressLine1: property.location.addressLine1 ?? "",
      formattedAddress: property.location.formattedAddress ?? "",
      city: property.location.city,
      state: property.location.state,
      country: property.location.country,
      latitude: property.location.latitude == null ? "" : String(property.location.latitude),
      longitude: property.location.longitude == null ? "" : String(property.location.longitude),
      mapboxPlaceId: property.location.mapboxPlaceId ?? "",
      boundaryGeoJson: property.location.boundaryGeoJson
        ? JSON.stringify(property.location.boundaryGeoJson, null, 2)
        : "",
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

function requiredNumber(value: string) {
  return parseFlexibleNumber(value);
}

function optionalNumber(value: string) {
  return parseFlexibleNumber(value);
}

function parseBoundaryGeoJsonInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function serializeForm(state: PropertyFormState) {
  const isLand = state.propertyType === "LAND";

  return {
    title: state.title,
    shortDescription: state.shortDescription,
    description: state.description,
    propertyType: state.propertyType,
    status: state.status,
    isFeatured: state.isFeatured,
    priceFrom: requiredNumber(state.priceFrom),
    priceTo: optionalNumber(state.priceTo),
    currency: state.currency,
    bedrooms: isLand ? undefined : optionalNumber(state.bedrooms),
    bathrooms: isLand ? undefined : optionalNumber(state.bathrooms),
    parkingSpaces: isLand ? undefined : optionalNumber(state.parkingSpaces),
    sizeSqm: isLand ? undefined : optionalNumber(state.sizeSqm),
    landSizeSqm: isLand ? optionalNumber(state.landSizeSqm) : undefined,
    numberOfPlots: isLand ? optionalNumber(state.numberOfPlots) : undefined,
    landSaleUnit: isLand ? state.landSaleUnit : undefined,
    hectares: isLand ? optionalNumber(state.hectares) : undefined,
    acres: isLand ? optionalNumber(state.acres) : undefined,
    plotOptions: isLand
      ? state.plotOptions
          .filter((option) =>
            option.label.trim() ||
            option.sizeSqm.trim() ||
            option.numberOfPlots.trim() ||
            option.hectares.trim() ||
            option.acres.trim() ||
            option.price.trim() ||
            option.note.trim()
          )
          .map((option) => ({
            label: defaultLandOptionLabel(option),
            unit: option.unit,
            sizeSqm: optionalNumber(option.sizeSqm),
            numberOfPlots: optionalNumber(option.numberOfPlots),
            hectares: optionalNumber(option.hectares),
            acres: optionalNumber(option.acres),
            price: optionalNumber(option.price),
            currency: option.currency || state.currency,
            status: option.status,
            note: option.note || undefined,
          }))
      : [],
    brochureDocumentId: state.brochureDocumentId || undefined,
    videoUrl: state.videoUrl || undefined,
    offerEndsAt: state.offerEndsAt ? new Date(state.offerEndsAt).toISOString() : undefined,
    countdownLabel: state.countdownLabel || undefined,
    countdownEnabled: state.countdownEnabled,
    locationSummary: state.locationSummary || undefined,
    landmarks: state.landmarks
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    hasPaymentPlan: state.hasPaymentPlan,
    wishlistDurationDays: optionalNumber(state.wishlistDurationDays),
    wishlistReminderEnabled: state.wishlistReminderEnabled,
    location: {
      addressLine1: state.location.addressLine1 || undefined,
      formattedAddress: state.location.formattedAddress || undefined,
      city: state.location.city,
      state: state.location.state,
      country: state.location.country,
      latitude: optionalNumber(state.location.latitude),
      longitude: optionalNumber(state.location.longitude),
      mapboxPlaceId: state.location.mapboxPlaceId || undefined,
      boundaryGeoJson: parseBoundaryGeoJsonInput(state.location.boundaryGeoJson),
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
        sortOrder: requiredNumber(item.sortOrder || String(index)),
        isPrimary: item.isPrimary,
        visibility: item.visibility,
      })),
    units: isLand
      ? []
      : state.units
          .filter((unit) => unit.unitCode.trim() && unit.title.trim() && unit.price.trim())
          .map((unit) => ({
            id: unit.id,
            unitCode: unit.unitCode,
            title: unit.title,
            status: unit.status,
            price: requiredNumber(unit.price),
            bedrooms: optionalNumber(unit.bedrooms),
            bathrooms: optionalNumber(unit.bathrooms),
            sizeSqm: optionalNumber(unit.sizeSqm),
            floor: optionalNumber(unit.floor),
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
        durationMonths: requiredNumber(plan.durationMonths || "0"),
        installmentCount: optionalNumber(plan.installmentCount),
        depositPercent: optionalNumber(plan.depositPercent),
        downPaymentAmount: optionalNumber(plan.downPaymentAmount),
        isActive: plan.isActive,
        installments: plan.installments
          .filter((installment) => installment.title.trim() && installment.amount.trim())
          .map((installment, index) => ({
            id: installment.id,
            title: installment.title,
            amount: requiredNumber(installment.amount),
            dueInDays: requiredNumber(installment.dueInDays || "0"),
            scheduleLabel: installment.scheduleLabel || undefined,
            sortOrder: requiredNumber(installment.sortOrder || String(index)),
          })),
      })),
  };
}

function normalizeMediaSortOrder(
  media: PropertyFormState["media"],
): PropertyFormState["media"] {
  return media.map((item, index) => ({
    ...item,
    sortOrder: String(index),
  }));
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
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>(
    Object.fromEntries(properties.map((property) => [property.id, property.verificationNotes ?? ""])),
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
      const json = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      toast.error(formatApiError(json, "Unable to create property."));
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
      const json = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      toast.error(formatApiError(json, "Unable to update property."));
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

  async function verifyProperty(propertyId: string) {
    setPending(`${propertyId}:verify`);
    const response = await fetch(`/api/admin/properties/${propertyId}/verify`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notes: verificationNotes[propertyId] || undefined,
      }),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to verify property.");
      return;
    }

    toast.success("Property verified and kept public.");
    router.refresh();
  }

  async function runVerificationSweep() {
    setPending("verification-sweep");
    const response = await fetch("/api/admin/properties/verification/run", {
      method: "POST",
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to refresh verification state.");
      return;
    }

    toast.success("Verification states refreshed.");
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
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={runVerificationSweep}
              disabled={pending === "verification-sweep"}
            >
              {pending === "verification-sweep" ? "Refreshing..." : "Refresh verification"}
            </Button>
            <Badge>Tenant-safe</Badge>
          </div>
        </div>
        <PropertyEditor
          idPrefix="create"
          value={createState}
          brochures={brochures}
          onChange={setCreateState}
          onSubmit={submitCreate}
          submitLabel={pending === "create" ? "Creating..." : "Create property"}
          disabled={pending === "create"}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.38fr_0.62fr]">
        <Card className="admin-surface p-6">
          <SectionTitle
            title="Existing inventory"
            description="Select a listing to adjust inventory, media, and publishing state."
          />
          <div className="mt-5 grid gap-3">
            {properties.length > 0 ? properties.map((property) => (
              <button
                key={property.id}
                type="button"
                onClick={() => setEditingId(property.id)}
                className={`admin-focus admin-interactive w-full min-w-0 rounded-[var(--radius-lg)] border px-4 py-4 text-left transition ${
                  editingId === property.id
                    ? "border-[var(--brand-500)] bg-[var(--sand-100)] shadow-[var(--shadow-sm)]"
                    : "border-[var(--border-subtle,var(--line))] bg-white shadow-[var(--shadow-xs)] hover:border-[var(--line)] hover:bg-[var(--sand-50)]"
                }`}
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[var(--ink-950)]">{property.title}</div>
                    <div className="mt-1 truncate text-sm text-[var(--ink-500)]">{property.location.city}, {property.location.state}</div>
                    <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-500)]">{property.verification.label}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <Badge className="whitespace-nowrap">{property.status.toLowerCase()}</Badge>
                    <Badge
                      className={
                        property.verification.tone === "success"
                          ? "whitespace-nowrap bg-emerald-100 text-emerald-800"
                          : property.verification.tone === "warning"
                            ? "whitespace-nowrap bg-amber-100 text-amber-800"
                            : "whitespace-nowrap bg-slate-200 text-slate-800"
                      }
                    >
                      {property.verificationStatus.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              </button>
            )) : (
              <AdminEmptyState
                title="No listings yet"
                description="Create your first property to begin managing inventory, media, and public visibility."
              />
            )}
          </div>
        </Card>

        <Card className="admin-surface p-6">
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
                    onClick={() => verifyProperty(editingId)}
                    disabled={pending === `${editingId}:verify`}
                  >
                    {pending === `${editingId}:verify` ? "Verifying..." : "Verify property"}
                  </Button>
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
                idPrefix={editingId}
                value={drafts[editingId] ?? toFormState(editingProperty)}
                brochures={brochures}
                onChange={(next) => updateDraft(editingId, () => next)}
                onSubmit={() => submitUpdate(editingId)}
                submitLabel={pending === editingId ? "Saving..." : "Save changes"}
                disabled={pending === editingId}
              />
              <div className="mt-6 rounded-3xl border border-[var(--line)] bg-[var(--sand-100)] p-5">
                <SectionTitle
                  title="Verification trust layer"
                  description={editingProperty.verification.detail}
                />
                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                  <Textarea
                    placeholder="Optional verification note for internal audit context"
                    value={verificationNotes[editingId] ?? ""}
                    onChange={(event) =>
                      setVerificationNotes((current) => ({
                        ...current,
                        [editingId]: event.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <Badge
                      className={
                        editingProperty.verification.tone === "success"
                          ? "bg-emerald-100 text-emerald-800"
                          : editingProperty.verification.tone === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-800"
                      }
                    >
                      {editingProperty.verification.label}
                    </Badge>
                    <Badge className="whitespace-nowrap">
                      {editingProperty.isPubliclyVisible ? "Publicly visible" : "Hidden from public"}
                    </Badge>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <AdminEmptyState
              title="Select a property to start editing"
              description="Choose an inventory item on the left to adjust copy, pricing, media, and visibility."
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function PropertyEditor({
  idPrefix,
  value,
  brochures,
  onChange,
  onSubmit,
  submitLabel,
  disabled,
}: {
  idPrefix: string;
  value: PropertyFormState;
  brochures: Array<{ id: string; fileName: string }>;
  onChange: (next: PropertyFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  const isLand = value.propertyType === "LAND";
  const landOptionCopy = LAND_OPTION_LABELS[value.landSaleUnit] ?? LAND_OPTION_LABELS.CUSTOM;

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
        <Input placeholder="Starting price (required)" value={value.priceFrom} onChange={(event) => update("priceFrom", event.target.value)} />
        <Input placeholder="Maximum price / range end (optional)" value={value.priceTo} onChange={(event) => update("priceTo", event.target.value)} />
        <select
          className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
          value={value.currency}
          onChange={(event) => update("currency", event.target.value)}
        >
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
        {isLand ? (
          <>
            <select
              className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
              value={value.landSaleUnit}
              onChange={(event) => update("landSaleUnit", event.target.value)}
            >
              <option value="PLOT">Sell by plot</option>
              <option value="SQM">Sell by sqm</option>
              <option value="HECTARE">Sell by hectare</option>
              <option value="ACRE">Sell by acre</option>
              <option value="CUSTOM">Custom</option>
            </select>
            {value.landSaleUnit === "SQM" || value.landSaleUnit === "PLOT" ? (
              <Input
                placeholder={value.landSaleUnit === "PLOT" ? "Plot size (sqm, optional)" : "Land size (sqm)"}
                value={value.landSizeSqm}
                onChange={(event) => update("landSizeSqm", event.target.value)}
              />
            ) : null}
            {value.landSaleUnit === "PLOT" ? (
              <Input placeholder="Number of plots" value={value.numberOfPlots} onChange={(event) => update("numberOfPlots", event.target.value)} />
            ) : null}
            {value.landSaleUnit === "HECTARE" ? (
              <Input placeholder="Hectares" value={value.hectares} onChange={(event) => update("hectares", event.target.value)} />
            ) : null}
            {value.landSaleUnit === "ACRE" ? (
              <Input placeholder="Acres" value={value.acres} onChange={(event) => update("acres", event.target.value)} />
            ) : null}
          </>
        ) : (
          <>
            <Input placeholder="Bedrooms" value={value.bedrooms} onChange={(event) => update("bedrooms", event.target.value)} />
            <Input placeholder="Bathrooms" value={value.bathrooms} onChange={(event) => update("bathrooms", event.target.value)} />
            <Input placeholder="Parking spaces" value={value.parkingSpaces} onChange={(event) => update("parkingSpaces", event.target.value)} />
            <Input placeholder="Size (sqm)" value={value.sizeSqm} onChange={(event) => update("sizeSqm", event.target.value)} />
          </>
        )}
        <Input placeholder="Wishlist duration (days)" value={value.wishlistDurationDays} onChange={(event) => update("wishlistDurationDays", event.target.value)} />
      </div>

      {isLand ? (
        <ArraySection
          title="Land size and plot options"
          onAdd={() =>
            update("plotOptions", [
              ...value.plotOptions,
              newLandOption(value.landSaleUnit, value.currency),
            ])
          }
          addLabel={landOptionCopy.button}
        >
          {value.plotOptions.length === 0 ? (
            <p className="text-sm text-[var(--ink-500)]">{landOptionCopy.empty}</p>
          ) : null}
          {value.plotOptions.map((option, index) => (
            <div key={`plot-option-${index}`} className="grid gap-3 rounded-3xl border border-[var(--line)] p-4 md:grid-cols-3">
              <Input
                placeholder="Label e.g. 350 sqm"
                value={option.label}
                onChange={(event) =>
                  update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))
                }
              />
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={option.unit}
                onChange={(event) =>
                  update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item))
                }
              >
                <option value="SQM">SQM</option>
                <option value="PLOT">Plot</option>
                <option value="HECTARE">Hectare</option>
                <option value="ACRE">Acre</option>
                <option value="CUSTOM">Custom</option>
              </select>
              {option.unit === "SQM" ? (
                <Input
                  placeholder="Size (sqm)"
                  value={option.sizeSqm}
                  onChange={(event) =>
                    update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, sizeSqm: event.target.value } : item))
                  }
                />
              ) : null}
              {option.unit === "PLOT" ? (
                <Input
                  placeholder="Number of plots"
                  value={option.numberOfPlots}
                  onChange={(event) =>
                    update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, numberOfPlots: event.target.value } : item))
                  }
                />
              ) : null}
              {option.unit === "HECTARE" ? (
                <Input
                  placeholder="Hectares"
                  value={option.hectares}
                  onChange={(event) =>
                    update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, hectares: event.target.value } : item))
                  }
                />
              ) : null}
              {option.unit === "ACRE" ? (
                <Input
                  placeholder="Acres"
                  value={option.acres}
                  onChange={(event) =>
                    update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, acres: event.target.value } : item))
                  }
                />
              ) : null}
              <Input
                placeholder="Price"
                value={option.price}
                onChange={(event) =>
                  update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, price: event.target.value } : item))
                }
              />
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={option.currency}
                onChange={(event) =>
                  update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, currency: event.target.value } : item))
                }
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={option.status}
                onChange={(event) =>
                  update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value } : item))
                }
              >
                <option value="AVAILABLE">Available</option>
                <option value="RESERVED">Reserved</option>
                <option value="SOLD">Sold</option>
              </select>
              <Input
                placeholder="Optional note"
                value={option.note}
                onChange={(event) =>
                  update("plotOptions", value.plotOptions.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => update("plotOptions", value.plotOptions.filter((_, itemIndex) => itemIndex !== index))}
              >
                Remove option
              </Button>
            </div>
          ))}
        </ArraySection>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <UploadField
          inputId={`brochure-upload-${idPrefix}`}
          label="Brochure"
          purpose="BROCHURE"
          surface="admin"
          mode="document"
          helperText="Public brochure document used on the tenant property page."
          value={{
            documentId: value.brochureDocumentId || null,
            fileName:
              brochures.find((brochure) => brochure.id === value.brochureDocumentId)?.fileName ?? null,
          }}
          onChange={(uploaded) => update("brochureDocumentId", uploaded.documentId ?? "")}
        />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--ink-700)]">Existing uploaded brochure</span>
          <select
            className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
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
        </label>
        <UploadField
          inputId={`walkthrough-video-upload-${idPrefix}`}
          label="Walkthrough video"
          purpose="PROPERTY_WALKTHROUGH_VIDEO"
          surface="admin"
          mode="publicAsset"
          helperText="Upload MP4, WebM, or MOV walkthroughs up to 100MB, or keep using an external video URL."
          allowExternalUrl
          externalUrlLabel="Or paste walkthrough video URL"
          value={{
            url: value.videoUrl || null,
          }}
          onChange={(uploaded) => update("videoUrl", uploaded.url ?? "")}
        />
      </div>

      <PropertyLocationPicker
        value={value.location}
        onChange={(nextLocation) => update("location", nextLocation)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Input placeholder="Address line 1" value={value.location.addressLine1} onChange={(event) => update("location", { ...value.location, addressLine1: event.target.value })} />
        <Input placeholder="Formatted address" value={value.location.formattedAddress} onChange={(event) => update("location", { ...value.location, formattedAddress: event.target.value })} />
        <Input placeholder="Neighborhood" value={value.location.neighborhood} onChange={(event) => update("location", { ...value.location, neighborhood: event.target.value })} />
        <Input placeholder="City" value={value.location.city} onChange={(event) => update("location", { ...value.location, city: event.target.value })} />
        <Input placeholder="State" value={value.location.state} onChange={(event) => update("location", { ...value.location, state: event.target.value })} />
        <Input placeholder="Country" value={value.location.country} onChange={(event) => update("location", { ...value.location, country: event.target.value })} />
        <Input placeholder="Postal code" value={value.location.postalCode} onChange={(event) => update("location", { ...value.location, postalCode: event.target.value })} />
        <Input placeholder="Latitude" value={value.location.latitude} onChange={(event) => update("location", { ...value.location, latitude: event.target.value })} />
        <Input placeholder="Longitude" value={value.location.longitude} onChange={(event) => update("location", { ...value.location, longitude: event.target.value })} />
        <Input placeholder="Mapbox place ID" value={value.location.mapboxPlaceId} onChange={(event) => update("location", { ...value.location, mapboxPlaceId: event.target.value })} />
      </div>

      <Textarea
        placeholder="Boundary GeoJSON"
        value={value.location.boundaryGeoJson}
        onChange={(event) => update("location", { ...value.location, boundaryGeoJson: event.target.value })}
      />

      <Textarea
        placeholder="Nearby landmarks, comma separated"
        value={value.landmarks}
        onChange={(event) => update("landmarks", event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] px-4 py-4">
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.hasPaymentPlan}
            onChange={(event) => update("hasPaymentPlan", event.target.checked)}
          />
          Payment plan available
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.wishlistReminderEnabled}
            onChange={(event) => update("wishlistReminderEnabled", event.target.checked)}
          />
          Wishlist reminder email enabled
        </label>
      </div>

      <div className="grid gap-4 rounded-3xl border border-[var(--line)] bg-white p-4 md:grid-cols-[auto_1fr_1fr]">
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.countdownEnabled}
            onChange={(event) => update("countdownEnabled", event.target.checked)}
          />
          Show countdown
        </label>
        <Input
          placeholder="Countdown label"
          value={value.countdownLabel}
          onChange={(event) => update("countdownLabel", event.target.value)}
        />
        <Input
          type="datetime-local"
          value={value.offerEndsAt}
          onChange={(event) => update("offerEndsAt", event.target.value)}
        />
      </div>

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
        <MultiUploadDropzone
          purpose="PROPERTY_MEDIA"
          surface="admin"
          helperText="Upload a full gallery in one pass. Newly uploaded media lands below where you can set titles, primary image, ordering, and visibility."
          onUploaded={(assets) =>
            update("media", [
              ...value.media,
              ...assets.map((asset, index) => ({
                title: asset.fileName?.replace(/\.[^.]+$/, "") ?? "",
                url: asset.url ?? "",
                mimeType: asset.mimeType ?? "",
                sortOrder: String(value.media.length + index),
                isPrimary: value.media.every((item) => !item.url) && index === 0,
                visibility: "PUBLIC" as const,
              })),
            ])
          }
        />
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
            <UploadField
              inputId={`media-upload-${idPrefix}-${index}`}
              label={`Media file ${index + 1}`}
              purpose="PROPERTY_MEDIA"
              surface="admin"
              mode="publicAsset"
              allowExternalUrl
              helperText="Upload tenant-scoped public media or keep an external media URL when appropriate."
              value={{ url: media.url, fileName: media.title || null }}
              onChange={(uploaded) =>
                update(
                  "media",
                  value.media.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          url: uploaded.url ?? "",
                          mimeType: uploaded.mimeType ?? item.mimeType,
                        }
                      : item,
                  ),
                )
              }
            />
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
              <Button
                type="button"
                variant="outline"
                disabled={index === 0}
                onClick={() =>
                  update(
                    "media",
                    normalizeMediaSortOrder(value.media.map((item, itemIndex) => {
                      if (itemIndex === index - 1) return value.media[index];
                      if (itemIndex === index) return value.media[index - 1];
                      return item;
                    })),
                  )
                }
              >
                Move up
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={index === value.media.length - 1}
                onClick={() =>
                  update(
                    "media",
                    normalizeMediaSortOrder(value.media.map((item, itemIndex) => {
                      if (itemIndex === index + 1) return value.media[index];
                      if (itemIndex === index) return value.media[index + 1];
                      return item;
                    })),
                  )
                }
              >
                Move down
              </Button>
            </div>
          </div>
        ))}
      </ArraySection>

      {!isLand ? (
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
      ) : null}

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
  addLabel = "Add",
  children,
}: {
  title: string;
  onAdd: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle title={title} description={`Manage ${title.toLowerCase()} for this listing.`} />
        <Button type="button" variant="outline" onClick={onAdd}>
          {addLabel}
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
