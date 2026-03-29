import Image from "next/image";

import { Container } from "@/components/shared/container";
import { getPublicBlogPostBySlug, getPublicCmsContext } from "@/modules/cms/queries";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPublicCmsContext();
  const post = await getPublicBlogPostBySlug(slug, tenant);

  return (
    <Container className="space-y-8 py-16">
      <div className="space-y-4">
        <div className="text-sm text-[var(--ink-500)]">{post.publishedAt}</div>
        <h1 className="max-w-4xl font-serif text-5xl text-[var(--ink-950)]">{post.title}</h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--ink-600)]">{post.excerpt}</p>
      </div>
      <div className="relative h-[420px]">
        <Image src={post.coverImageUrl} alt={post.title} fill className="rounded-[32px] object-cover" />
      </div>
      <article className="max-w-3xl space-y-6 text-base leading-8 text-[var(--ink-700)]">
        {post.content.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </article>
    </Container>
  );
}
