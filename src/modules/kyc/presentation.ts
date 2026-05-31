export const nigeriaBuyerIdentityDocuments = [
  ["NIN", "NIN slip/card"],
  ["PASSPORT", "International Passport"],
  ["DRIVERS_LICENSE", "Driver's License"],
  ["VOTERS_CARD", "Voter's Card"],
] as const;

export const globalBuyerIdentityDocuments = [
  ["NATIONAL_ID", "National ID"],
  ["PASSPORT", "International Passport"],
  ["DRIVERS_LICENSE", "Driver's License"],
  ["RESIDENCE_PERMIT", "Residence Permit"],
] as const;

const kycAllowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type MinimalBuyerProfile = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
};

export function getAcceptedBuyerIdentityDocuments(country?: string | null) {
  return country?.trim().toLowerCase() === "nigeria"
    ? nigeriaBuyerIdentityDocuments
    : globalBuyerIdentityDocuments;
}

export function getBuyerProfileKycChecklist(profile: MinimalBuyerProfile | null) {
  const fullName = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
  const hasLocation = Boolean(profile?.addressLine1?.trim()) || Boolean(profile?.city?.trim() && profile?.state?.trim());

  return [
    { label: "Full name", complete: fullName.length >= 2 },
    { label: "Email", complete: Boolean(profile?.email?.trim()) },
    { label: "Phone", complete: Boolean(profile?.phone?.trim()) },
    { label: "Country", complete: Boolean(profile?.country?.trim()) },
    { label: "Address or city/state", complete: hasLocation },
  ];
}

export function isBuyerProfileReadyForKyc(profile: MinimalBuyerProfile | null) {
  return getBuyerProfileKycChecklist(profile).every((item) => item.complete);
}

export function isSupportedKycDocumentMimeType(mimeType?: string | null) {
  return Boolean(mimeType && kycAllowedMimeTypes.has(mimeType.toLowerCase()));
}

export function getKycDocumentFormatMessage(mimeType?: string | null) {
  return isSupportedKycDocumentMimeType(mimeType)
    ? null
    : "Unsupported document format. Please replace this document.";
}
