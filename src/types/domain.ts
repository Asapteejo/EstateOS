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
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  sizeSqm: number;
  locationSummary: string;
  city: string;
  state: string;
  coordinates: [number, number];
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
  fullName: string;
  role: string;
  company?: string;
  quote: string;
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
