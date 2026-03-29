import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { requirePublicTenantContext, type TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant } from "@/lib/tenancy/db";
import { formatDate } from "@/lib/utils";
import { blogPosts, faqs, teamMembers, testimonials } from "@/modules/cms/demo-data";
import type { BlogPost, FaqItem, TeamMember, Testimonial } from "@/types/domain";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

export async function getPublicCmsContext() {
  return requirePublicTenantContext();
}

export async function getPublicTestimonials(context?: TenantContext): Promise<Testimonial[]> {
  if (!featureFlags.hasDatabase || !context?.companyId) {
    return testimonials;
  }

  const rows = (await findManyForTenant(
    prisma.testimonial as ScopedFindManyDelegate,
    context,
    {
      where: {
        isPublished: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        fullName: true,
        role: true,
        companyName: true,
        quote: true,
      },
    } as Parameters<typeof prisma.testimonial.findMany>[0],
  )) as Array<{
    fullName: string;
    role: string | null;
    companyName: string | null;
    quote: string;
  }>;

  return rows.map((row) => ({
    fullName: row.fullName,
    role: row.role ?? "Client",
    company: row.companyName ?? undefined,
    quote: row.quote,
  }));
}

export async function getPublicFaqs(context?: TenantContext): Promise<FaqItem[]> {
  if (!featureFlags.hasDatabase || !context?.companyId) {
    return faqs;
  }

  const rows = (await findManyForTenant(
    prisma.fAQItem as ScopedFindManyDelegate,
    context,
    {
      where: {
        isPublished: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        question: true,
        answer: true,
        category: true,
      },
    } as Parameters<typeof prisma.fAQItem.findMany>[0],
  )) as Array<{
    question: string;
    answer: string;
    category: string | null;
  }>;

  return rows.map((row) => ({
    question: row.question,
    answer: row.answer,
    category: row.category ?? "General",
  }));
}

export async function getPublicTeamMembers(context?: TenantContext): Promise<TeamMember[]> {
  if (!featureFlags.hasDatabase || !context?.companyId) {
    return teamMembers;
  }

  const rows = (await findManyForTenant(
    prisma.teamMember as ScopedFindManyDelegate,
    context,
    {
      where: {
        isPublished: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        slug: true,
        fullName: true,
        title: true,
        bio: true,
        email: true,
        phone: true,
        avatarUrl: true,
      },
    } as Parameters<typeof prisma.teamMember.findMany>[0],
  )) as Array<{
    slug: string;
    fullName: string;
    title: string;
    bio: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  }>;

  return rows.map((row) => ({
    slug: row.slug,
    fullName: row.fullName,
    title: row.title,
    bio: row.bio,
    email: row.email ?? "",
    phone: row.phone ?? "",
    image: row.avatarUrl ?? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
  }));
}

export async function getPublicBlogPosts(context?: TenantContext): Promise<BlogPost[]> {
  if (!featureFlags.hasDatabase || !context?.companyId) {
    return blogPosts;
  }

  const rows = (await findManyForTenant(
    prisma.blogPost as ScopedFindManyDelegate,
    context,
    {
      where: {
        isPublished: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        slug: true,
        title: true,
        excerpt: true,
        coverImageUrl: true,
        authorName: true,
        publishedAt: true,
        content: true,
      },
    } as Parameters<typeof prisma.blogPost.findMany>[0],
  )) as Array<{
    slug: string;
    title: string;
    excerpt: string;
    coverImageUrl: string | null;
    authorName: string;
    publishedAt: Date | null;
    content: string;
  }>;

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl:
      row.coverImageUrl ??
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    authorName: row.authorName,
    publishedAt: row.publishedAt ? formatDate(row.publishedAt, "yyyy-MM-dd") : "Draft",
    content: row.content.split(/\n{2,}/).filter(Boolean),
  }));
}

export async function getPublicBlogPostBySlug(
  slug: string,
  context?: TenantContext,
): Promise<BlogPost> {
  if (!featureFlags.hasDatabase || !context?.companyId) {
    const post = blogPosts.find((entry) => entry.slug === slug);
    if (!post) {
      notFound();
    }

    return post;
  }

  const post = (await findFirstForTenant(
    prisma.blogPost as ScopedFindFirstDelegate,
    context,
    {
      where: {
        slug,
        isPublished: true,
      },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        coverImageUrl: true,
        authorName: true,
        publishedAt: true,
        content: true,
      },
    } as Parameters<typeof prisma.blogPost.findFirst>[0],
  )) as {
    slug: string;
    title: string;
    excerpt: string;
    coverImageUrl: string | null;
    authorName: string;
    publishedAt: Date | null;
    content: string;
  } | null;

  if (!post) {
    notFound();
  }

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverImageUrl:
      post.coverImageUrl ??
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    authorName: post.authorName,
    publishedAt: post.publishedAt ? formatDate(post.publishedAt, "yyyy-MM-dd") : "Draft",
    content: post.content.split(/\n{2,}/).filter(Boolean),
  };
}
