import Link from "next/link";
import Image from "next/image";

import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { getPublicBlogPosts, getPublicCmsContext } from "@/modules/cms/queries";
import type { BlogPost } from "@/types/domain";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "Draft";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Draft";
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Cover({ post }: { post: BlogPost }) {
  if (post.coverImageUrl) {
    return (
      <Image
        src={post.coverImageUrl}
        alt={post.title}
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
    );
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--brand-100,#dcfce7)] to-[var(--sand-200,#e7e5e4)]"
      aria-hidden
    >
      <span className="text-2xl font-semibold tracking-tight text-[var(--brand-700)]">
        {post.title.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}

export default async function BlogPage() {
  const tenant = await getPublicCmsContext();
  const blogPosts = await getPublicBlogPosts(tenant);

  const [featured, ...rest] = blogPosts;

  return (
    <Container className="space-y-10 py-16">
      <Reveal>
        <SectionHeading
          eyebrow="Insights"
          title="Guidance for buyers, operators, and investors."
          description="Practical reading on buying with confidence, protecting your money, and understanding every step of a property transaction."
        />
      </Reveal>

      {blogPosts.length === 0 ? (
        <EmptyState
          title="No articles published yet"
          description="New insights and guides will appear here as the team publishes them."
        />
      ) : (
        <div className="space-y-8">
          <Reveal>
            <Link href={`/blog/${featured.slug}`} className="group block">
              <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                <div className="grid lg:grid-cols-2">
                  <div className="relative aspect-[16/10] lg:aspect-auto">
                    <Cover post={featured} />
                  </div>
                  <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
                    <div className="flex items-center gap-2 text-xs text-[var(--ink-500)]">
                      <span className="rounded-full bg-[var(--brand-100,#dcfce7)] px-2.5 py-0.5 font-medium text-[var(--brand-700)]">
                        Featured
                      </span>
                      <span>{formatDate(featured.publishedAt)}</span>
                    </div>
                    <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink-950)] group-hover:text-[var(--brand-700)] sm:text-3xl">
                      {featured.title}
                    </h3>
                    <p className="text-sm leading-7 text-[var(--ink-600)]">{featured.excerpt}</p>
                    <div className="mt-1 text-sm text-[var(--ink-500)]">By {featured.authorName}</div>
                  </div>
                </div>
              </Card>
            </Link>
          </Reveal>

          {rest.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <Reveal key={post.slug}>
                  <Link href={`/blog/${post.slug}`} className="group block h-full">
                    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
                      <div className="relative aspect-[16/10]">
                        <Cover post={post} />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-5">
                        <div className="text-xs text-[var(--ink-500)]">{formatDate(post.publishedAt)}</div>
                        <h3 className="text-lg font-semibold leading-snug text-[var(--ink-950)] group-hover:text-[var(--brand-700)]">
                          {post.title}
                        </h3>
                        <p className="line-clamp-3 text-sm leading-6 text-[var(--ink-600)]">{post.excerpt}</p>
                        <div className="mt-auto pt-2 text-xs text-[var(--ink-500)]">By {post.authorName}</div>
                      </div>
                    </Card>
                  </Link>
                </Reveal>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Container>
  );
}
