import Link from "next/link";
import Image from "next/image";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { getPublicBlogPosts, getPublicCmsContext } from "@/modules/cms/queries";

export default async function BlogPage() {
  const tenant = await getPublicCmsContext();
  const blogPosts = await getPublicBlogPosts(tenant);

  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="Insights"
        title="Content for buyers, operators, and investors."
        description="The blog module is scaffolded for editorial publishing and trust-building education content."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {blogPosts.map((post) => (
          <Card key={post.slug} className="overflow-hidden">
            <div className="relative h-72">
              <Image src={post.coverImageUrl} alt={post.title} fill className="object-cover" />
            </div>
            <div className="space-y-3 p-6">
              <div className="text-sm text-[var(--ink-500)]">{post.publishedAt}</div>
              <h3 className="text-2xl font-semibold text-[var(--ink-950)]">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h3>
              <p className="text-sm leading-7 text-[var(--ink-600)]">{post.excerpt}</p>
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
