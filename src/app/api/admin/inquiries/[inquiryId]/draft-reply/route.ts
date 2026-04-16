import Anthropic from "@anthropic-ai/sdk";

import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ inquiryId: string }> },
) {
  const tenant = await requireAdminSession();
  const { inquiryId } = await params;

  if (!featureFlags.hasAnthropicAi) {
    return Response.json({ error: "AI drafting is not configured." }, { status: 503 });
  }
  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return Response.json({ error: "Service unavailable." }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inquiry = (await (prisma.inquiry.findFirst as (args: any) => Promise<any>)({
    where: { id: inquiryId, companyId: tenant.companyId },
    select: {
      id: true,
      fullName: true,
      email: true,
      message: true,
      property: {
        select: { title: true, shortDescription: true },
      },
    },
  })) as {
    id: string;
    fullName: string;
    email: string;
    message: string;
    property: { title: string; shortDescription: string } | null;
  } | null;

  if (!inquiry) {
    return Response.json({ error: "Inquiry not found." }, { status: 404 });
  }

  const company = await prisma.company.findUnique({
    where: { id: tenant.companyId },
    select: { name: true },
  });
  const companyName = company?.name ?? "our company";

  const propertyContext = inquiry.property
    ? `Property enquired about: "${inquiry.property.title}"${inquiry.property.shortDescription ? `\nProperty summary: ${inquiry.property.shortDescription}` : ""}`
    : "General inquiry — no specific property selected.";

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a professional sales assistant at ${companyName}, a real estate company. Draft a warm, professional first-response email to a buyer who submitted a property inquiry.

Guidelines:
- Address the buyer by first name only
- Acknowledge their specific inquiry and the property if applicable
- Be helpful and express genuine interest in assisting them
- Propose a clear next step (e.g. schedule a viewing or call)
- Keep it concise — 150 to 200 words
- Sign off as "The ${companyName} Team"

Output only the email body text starting with "Dear [Name]," — no subject line, no extra commentary.`,
    messages: [
      {
        role: "user",
        content: `Buyer name: ${inquiry.fullName}
Buyer email: ${inquiry.email}
${propertyContext}

Their message:
"${inquiry.message}"

Draft the personalised first-response email.`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
