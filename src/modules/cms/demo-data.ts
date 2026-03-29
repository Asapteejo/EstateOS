import type { BlogPost, FaqItem, TeamMember, Testimonial } from "@/types/domain";

export const teamMembers: TeamMember[] = [
  {
    slug: "amina-bello",
    fullName: "Amina Bello",
    title: "Head of Sales",
    bio: "Amina leads revenue and buyer advisory, translating complex purchase journeys into clear next steps clients can trust.",
    email: "amina@acmerealty.dev",
    phone: "+234 801 000 9001",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
  },
  {
    slug: "tobi-adeyemi",
    fullName: "Tobi Adeyemi",
    title: "Transactions Lead",
    bio: "Tobi owns reservation, payment reconciliation, and milestone coordination across legal, finance, and client success.",
    email: "tobi@acmerealty.dev",
    phone: "+234 801 000 9002",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
  },
  {
    slug: "ifeoma-udeh",
    fullName: "Ifeoma Udeh",
    title: "Legal & Compliance",
    bio: "Ifeoma coordinates title review, agreement issuance, and compliance workflows so buyers stay informed at every stage.",
    email: "ifeoma@acmerealty.dev",
    phone: "+234 801 000 9003",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&q=80",
  },
];

export const testimonials: Testimonial[] = [
  {
    fullName: "Chinonso Eze",
    role: "Buyer",
    company: "Diaspora Investor",
    quote:
      "The difference was visibility. I could see each payment, each milestone, every document, and exactly what the team was doing next.",
  },
  {
    fullName: "Maryam Yusuf",
    role: "Client",
    quote:
      "The reservation and document process felt premium and organized. It reduced the anxiety that usually comes with Nigerian property transactions.",
  },
  {
    fullName: "Kunle Adebayo",
    role: "Property Investor",
    quote:
      "What stood out was the clarity of receipts, status updates, and staff accountability. This felt like a real transaction platform, not just a website.",
  },
];

export const faqs: FaqItem[] = [
  {
    category: "Buying",
    question: "How do I reserve a unit?",
    answer:
      "After selecting a property, you can book an inspection or start a purchase. Qualified buyers then receive reservation instructions and a time-bound reservation window.",
  },
  {
    category: "Payments",
    question: "Do you support installment payments?",
    answer:
      "Yes. Eligible listings show structured payment plans, deposit requirements, duration, and milestone expectations directly on the property page.",
  },
  {
    category: "Documents",
    question: "Are my KYC and contract files private?",
    answer:
      "Yes. Sensitive documents are stored privately and accessed through signed URLs and access logging. Public brochures are handled separately.",
  },
  {
    category: "Support",
    question: "Can diaspora buyers complete the process remotely?",
    answer:
      "Yes. The buyer portal is designed for remote visibility, document exchange, milestone updates, and payment tracking.",
  },
];

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-buy-off-plan-with-confidence",
    title: "How To Buy Off-Plan With More Confidence",
    excerpt:
      "A serious buyer journey depends on transparency in payment schedules, legal review, and post-reservation communication.",
    coverImageUrl:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    authorName: "Amina Bello",
    publishedAt: "2026-03-10",
    content: [
      "Off-plan real estate succeeds when trust compounds over time. Buyers need clarity on the title story, construction milestones, payment logic, and who is accountable internally.",
      "The strongest platforms reduce ambiguity. That means receipts that are easy to find, timelines that actually reflect the transaction state, and communication that happens before a buyer has to chase for updates.",
      "For operators, the lesson is straightforward: your website should not end where the transaction begins. The portal and internal workflow are part of the product.",
    ],
  },
  {
    slug: "building-trust-in-modern-real-estate-operations",
    title: "Building Trust In Modern Real Estate Operations",
    excerpt:
      "Operational trust is built from faster responses, visible milestones, and systems that keep buyers informed without friction.",
    coverImageUrl:
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80",
    authorName: "Tobi Adeyemi",
    publishedAt: "2026-03-18",
    content: [
      "Real estate teams often underinvest in the trust layer. When clients cannot tell what happened after payment or document submission, confidence erodes quickly.",
      "A modern operating model ties listings, CRM, transactions, documents, and notifications together. Internal staff also benefit because accountability is no longer trapped in private chats and spreadsheets.",
    ],
  },
];
