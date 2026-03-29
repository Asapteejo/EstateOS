import { PropertyCard } from "@/components/marketing/property-card";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getPublicProperties,
  getPublicPropertiesContext,
} from "@/modules/properties/queries";

export default async function PropertiesPage() {
  const tenant = await getPublicPropertiesContext();
  const properties = await getPublicProperties(tenant);

  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="Listings"
        title="Searchable inventory designed for conversion and trust."
        description="Filter by city, property type, bedrooms, pricing, status, and payment-plan fit. The first version ships the UI and seeded data foundation."
      />
      <Card className="grid gap-4 p-5 lg:grid-cols-6">
        <Input placeholder="Location" />
        <Input placeholder="Property type" />
        <Input placeholder="Min price" />
        <Input placeholder="Max price" />
        <Input placeholder="Bedrooms" />
        <div className="flex items-center rounded-2xl border border-[var(--line)] px-4 text-sm text-[var(--ink-600)]">
          Payment plan available
        </div>
      </Card>
      <div className="flex flex-wrap gap-3">
        {["Available", "Reserved", "Sold", "Lagos", "Abuja"].map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </div>
      {properties.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No public listings yet"
          description="This tenant has no published inventory available for public browsing right now."
        />
      )}
    </Container>
  );
}
