export type PropertySummary = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  type: string;
  status: "available" | "reserved" | "sold";
  featured: boolean;
  priceFrom: number;
  priceTo?: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  sizeSqm: number;
  landSizeSqm?: number;
  numberOfPlots?: number;
  landSaleUnit?: "SQM" | "PLOT" | "HECTARE" | "ACRE" | "CUSTOM";
  hectares?: number;
  acres?: number;
  plotOptions: Array<{
    label?: string;
    unit?: "SQM" | "PLOT" | "HECTARE" | "ACRE" | "CUSTOM";
    sizeSqm?: number;
    numberOfPlots?: number;
    hectares?: number;
    acres?: number;
    price?: number;
    currency?: string;
    status?: string;
    note?: string;
  }>;
  countdown?: {
    enabled: boolean;
    label: string;
    offerEndsAt: string;
  };
  locationSummary: string;
  city: string;
  state: string;
  formattedAddress?: string;
  coordinates: [number, number];
  hasCoordinates: boolean;
  boundaryCoordinates?: [number, number][];
  images: string[];
  paymentPlan: {
    title: string;
    summary: string;
    durationMonths: number;
    depositPercent: number;
  };
  features: string[];
  landmarks: string[];
  brochureName: string;
  inquiryCount: number;
  verification: {
    status: "VERIFIED" | "STALE" | "UNVERIFIED" | "HIDDEN";
    label: string;
    detail: string;
    tone: "success" | "warning" | "muted";
    isPubliclyVisible: boolean;
    lastVerifiedAt?: string;
    verificationDueAt: string;
  };
};

export type TeamMember = {
  slug: string;
  fullName: string;
  title: string;
  bio: string;
  email: string;
  phone: string;
  image: string;
};

export type Testimonial = {
  id?: string;
  fullName: string;
  displayName?: string;
  role: string;
  company?: string;
  quote: string;
  title?: string;
  rating?: number;
  avatarUrl?: string | null;
  propertyTitle?: string | null;
  isVerifiedBuyer?: boolean;
  publishedAt?: string;
};

export type FaqItem = {
  question: string;
  answer: string;
  category: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string;
  authorName: string;
  publishedAt: string;
  content: string[];
};
