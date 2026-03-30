import QRCode from "qrcode";

import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant } from "@/lib/tenancy/db";
import { buildMailtoHref, buildWhatsAppHref } from "@/modules/team/contact";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

export type StaffIdCardPayload = {
  companyName: string;
  companyLogoUrl: string | null;
  companyAddress: string | null;
  companySupportEmail: string | null;
  companySupportPhone: string | null;
  publicSiteUrl: string;
  fullName: string;
  title: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  staffCode: string | null;
  officeLocation: string | null;
  qrCodeDataUrl: string;
};

export function buildCompanyPublicSiteUrl(input: {
  appBaseUrl: string;
  customDomain?: string | null;
}) {
  if (input.customDomain) {
    return input.customDomain.startsWith("http")
      ? input.customDomain
      : `https://${input.customDomain}`;
  }

  return new URL("/properties", input.appBaseUrl).toString();
}

export async function getStaffIdCardPayload(
  context: TenantContext,
  teamMemberId: string,
): Promise<StaffIdCardPayload> {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    const publicSiteUrl = buildCompanyPublicSiteUrl({
      appBaseUrl: env.APP_BASE_URL,
    });

    return {
      companyName: "Acme Realty",
      companyLogoUrl: null,
      companyAddress: "12 Admiralty Way, Lekki Phase 1, Lagos",
      companySupportEmail: "support@acmerealty.dev",
      companySupportPhone: "+234 801 000 1000",
      publicSiteUrl,
      fullName: "Tobi Adewale",
      title: "Senior Sales Advisor",
      avatarUrl: null,
      email: "tobi@acmerealty.dev",
      phone: "+2348011111111",
      whatsappNumber: "+2348011111111",
      staffCode: "ACM-TEAM-001",
      officeLocation: "Lagos HQ",
      qrCodeDataUrl: await QRCode.toDataURL(publicSiteUrl, {
        margin: 1,
        width: 160,
      }),
    };
  }

  const member = (await findFirstForTenant(
    prisma.teamMember as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: teamMemberId,
      },
      select: {
        fullName: true,
        title: true,
        avatarUrl: true,
        email: true,
        phone: true,
        whatsappNumber: true,
        staffCode: true,
        officeLocation: true,
        company: {
          select: {
            name: true,
            logoUrl: true,
            customDomain: true,
          },
        },
      },
    } as Parameters<typeof prisma.teamMember.findFirst>[0],
  )) as {
    fullName: string;
    title: string;
    avatarUrl: string | null;
    email: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    staffCode: string | null;
    officeLocation: string | null;
    company: {
      name: string;
      logoUrl: string | null;
      customDomain: string | null;
    };
  } | null;

  if (!member) {
    throw new Error("Staff profile not found.");
  }

  const siteSettings = await prisma.siteSettings.findUnique({
    where: {
      companyId: context.companyId,
    },
    select: {
      address: true,
      supportEmail: true,
      supportPhone: true,
    },
  });

  const publicSiteUrl = buildCompanyPublicSiteUrl({
    appBaseUrl: env.APP_BASE_URL,
    customDomain: member.company.customDomain,
  });

  return {
    companyName: member.company.name,
    companyLogoUrl: member.company.logoUrl,
    companyAddress: siteSettings?.address ?? null,
    companySupportEmail: siteSettings?.supportEmail ?? null,
    companySupportPhone: siteSettings?.supportPhone ?? null,
    publicSiteUrl,
    fullName: member.fullName,
    title: member.title,
    avatarUrl: member.avatarUrl,
    email: member.email,
    phone: member.phone,
    whatsappNumber: member.whatsappNumber,
    staffCode: member.staffCode,
    officeLocation: member.officeLocation,
    qrCodeDataUrl: await QRCode.toDataURL(publicSiteUrl, {
      margin: 1,
      width: 160,
    }),
  };
}

export function renderStaffIdCardHtml(payload: StaffIdCardPayload) {
  const mailtoHref = buildMailtoHref(payload.email);
  const whatsappHref = buildWhatsAppHref(payload.whatsappNumber);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${payload.fullName} ID Card</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f3efe8; margin: 0; padding: 32px; color: #12202a; }
      .sheet { max-width: 960px; margin: 0 auto; }
      .card { display: grid; grid-template-columns: 1.2fr 0.8fr; overflow: hidden; border-radius: 28px; background: white; border: 1px solid #e6dfd4; }
      .left { padding: 32px; background: linear-gradient(160deg,#0c1820,#135747); color: white; }
      .right { padding: 32px; background: #faf8f3; display: flex; flex-direction: column; justify-content: space-between; }
      .brand { display: flex; gap: 16px; align-items: center; }
      .logo { width: 64px; height: 64px; border-radius: 20px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .logo img { width: 100%; height: 100%; object-fit: cover; }
      .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.72); }
      .avatar { width: 150px; height: 180px; border-radius: 24px; overflow: hidden; background: rgba(255,255,255,0.12); margin-top: 28px; }
      .avatar img { width: 100%; height: 100%; object-fit: cover; }
      .meta { margin-top: 28px; display: grid; gap: 12px; }
      .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #7c8a92; }
      .value { margin-top: 4px; font-size: 18px; font-weight: 700; color: #11212b; }
      .name { font-size: 34px; font-weight: 700; line-height: 1.1; color: #11212b; }
      .title { margin-top: 10px; color: #0f5b49; font-size: 18px; font-weight: 600; }
      .contact { display: grid; gap: 10px; margin-top: 22px; font-size: 14px; color: #465760; }
      .qr { width: 160px; height: 160px; border-radius: 24px; background: white; padding: 10px; border: 1px solid #e6dfd4; }
      .footer { display: flex; justify-content: space-between; gap: 20px; align-items: flex-end; margin-top: 28px; }
      .site { font-size: 12px; line-height: 1.6; color: #5f6d75; word-break: break-word; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="card">
        <div class="left">
          <div class="brand">
            <div class="logo">${payload.companyLogoUrl ? `<img src="${payload.companyLogoUrl}" alt="${payload.companyName}" />` : "EO"}</div>
            <div>
              <div class="eyebrow">Official staff identification</div>
              <div style="font-size:28px;font-weight:700;">${payload.companyName}</div>
              <div style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.78);">${payload.companyAddress ?? "Company address not configured"}</div>
            </div>
          </div>
          <div class="avatar">${payload.avatarUrl ? `<img src="${payload.avatarUrl}" alt="${payload.fullName}" />` : ""}</div>
        </div>
        <div class="right">
          <div>
            <div class="eyebrow" style="color:#8a7561;">EstateOS Staff Directory</div>
            <div class="name">${payload.fullName}</div>
            <div class="title">${payload.title}</div>

            <div class="meta">
              <div>
                <div class="label">Staff code</div>
                <div class="value">${payload.staffCode ?? "Not assigned"}</div>
              </div>
              <div>
                <div class="label">Office location</div>
                <div class="value">${payload.officeLocation ?? "Main office"}</div>
              </div>
            </div>

            <div class="contact">
              ${payload.email ? `<div>Email: ${payload.email}</div>` : ""}
              ${payload.phone ? `<div>Phone: ${payload.phone}</div>` : ""}
              ${payload.whatsappNumber ? `<div>WhatsApp: ${payload.whatsappNumber}</div>` : ""}
              ${payload.companySupportEmail ? `<div>Company email: ${payload.companySupportEmail}</div>` : ""}
              ${payload.companySupportPhone ? `<div>Company phone: ${payload.companySupportPhone}</div>` : ""}
            </div>
          </div>

          <div class="footer">
            <div>
              <img class="qr" src="${payload.qrCodeDataUrl}" alt="QR code for ${payload.companyName}" />
              <div class="site">
                QR destination: ${payload.publicSiteUrl}<br />
                ${mailtoHref ? `Email action enabled<br />` : ""}
                ${whatsappHref ? `WhatsApp action enabled` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
