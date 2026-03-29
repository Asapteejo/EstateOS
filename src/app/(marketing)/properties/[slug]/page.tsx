import Link from "next/link";
import Image from "next/image";

import { InquiryForm } from "@/components/marketing/inquiry-form";
import { InspectionForm } from "@/components/marketing/inspection-form";
import { MapSection } from "@/components/marketing/map-section";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  getPublicPropertiesContext,
  getPublicPropertyDetailBySlug,
} from "@/modules/properties/queries";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPublicPropertiesContext();
  const property = await getPublicPropertyDetailBySlug(slug, tenant);

  return (
    <div className="space-y-14 py-12">
      <Container className="space-y-8">
        <div className="flex flex-wrap items-center gap-4">
          <Badge>{property.status}</Badge>
          <Badge>{property.type}</Badge>
          <Badge>{property.city}</Badge>
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-5xl text-[var(--ink-950)]">{property.title}</h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--ink-600)]">
                {property.description}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative h-[440px] md:col-span-2">
                <Image
                  src={property.images[0] ?? "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"}
                  alt={property.title}
                  fill
                  className="rounded-[32px] object-cover"
                />
              </div>
              {property.images.slice(1).map((image) => (
                <div key={image} className="relative h-56">
                  <Image src={image} alt={property.title} fill className="rounded-[28px] object-cover" />
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-8">
                <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Location & map</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{property.locationSummary}</p>
                <div className="mt-6">
                  <MapSection title={property.locationSummary} coordinates={property.coordinates} />
                </div>
              </Card>
              <Card className="p-8">
                <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Nearby landmarks</h2>
                <div className="mt-6 space-y-3">
                  {property.landmarks.map((landmark) => (
                    <div key={landmark} className="rounded-2xl bg-[var(--sand-100)] px-4 py-3 text-sm text-[var(--ink-700)]">
                      {landmark}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="p-8">
              <div className="text-sm uppercase tracking-[0.18em] text-[var(--ink-500)]">Price</div>
              <div className="mt-2 text-4xl font-semibold text-[var(--ink-950)]">
                {formatCurrency(property.priceFrom)}
                {property.priceTo ? ` - ${formatCurrency(property.priceTo)}` : ""}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm text-[var(--ink-700)]">
                <div>{property.bedrooms} bedrooms</div>
                <div>{property.bathrooms} bathrooms</div>
                <div>{property.parkingSpaces} parking</div>
                <div>{property.sizeSqm} sqm</div>
              </div>
              <div className="mt-6 space-y-3">
                <Link href="/portal/reservations">
                  <Button className="w-full">Start purchase</Button>
                </Link>
                {property.brochureUrl ? (
                  <Link href={property.brochureUrl} className="block">
                    <Button variant="outline" className="w-full">
                      Download brochure
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Brochure unavailable
                  </Button>
                )}
              </div>
            </Card>
            <Card className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">Payment plan</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-600)]">
                {property.paymentPlan.summary}
              </p>
              <div className="mt-5 grid gap-3 text-sm text-[var(--ink-700)]">
                <div>Plan: {property.paymentPlan.title}</div>
                <div>Duration: {property.paymentPlan.durationMonths} months</div>
                <div>Deposit: {property.paymentPlan.depositPercent}%</div>
              </div>
            </Card>
            <Card className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">Available units</h2>
              <div className="mt-5 space-y-3">
                {property.units.length > 0 ? (
                  property.units.map((unit) => (
                    <div
                      key={unit.id}
                      className="rounded-2xl bg-[var(--sand-100)] px-4 py-4 text-sm text-[var(--ink-700)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="font-semibold text-[var(--ink-950)]">
                          {unit.title} ({unit.unitCode})
                        </div>
                        <Badge>{unit.status.toLowerCase()}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4">
                        <span>{formatCurrency(unit.price)}</span>
                        <span>{unit.bedrooms ?? 0} bed</span>
                        <span>{unit.bathrooms ?? 0} bath</span>
                        <span>{unit.sizeSqm ?? 0} sqm</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No unit breakdown published"
                    description="This property is currently marketed at the project level."
                  />
                )}
              </div>
            </Card>
            {property.videoUrl ? (
              <Card className="p-8">
                <h2 className="text-xl font-semibold text-[var(--ink-950)]">Video walkthrough</h2>
                <p className="mt-2 text-sm text-[var(--ink-600)]">
                  Preview the walkthrough or handoff this URL to a richer media viewer in phase 2.
                </p>
                <div className="mt-5">
                  <Link href={property.videoUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="w-full">
                      Open video walkthrough
                    </Button>
                  </Link>
                </div>
              </Card>
            ) : null}
            <Card className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">Book inspection</h2>
              <p className="mt-2 text-sm text-[var(--ink-600)]">
                Schedule a viewing or consultation with our transactions team.
              </p>
              <div className="mt-5">
                <InspectionForm propertyId={property.id} />
              </div>
            </Card>
            <Card className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">Send inquiry</h2>
              <div className="mt-5">
                <InquiryForm propertyId={property.id} />
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
