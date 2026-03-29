import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function PortalProfilePage() {
  return (
    <DashboardShell area="portal" title="Profile" subtitle="Collect identity and contact details early so downstream legal and finance workflows stay clean.">
      <Card className="grid gap-4 p-8 md:grid-cols-2">
        <Input placeholder="First name" />
        <Input placeholder="Last name" />
        <Input placeholder="Email address" />
        <Input placeholder="Phone number" />
        <Input placeholder="Occupation" />
        <Input placeholder="City" />
        <div className="md:col-span-2">
          <Button>Save profile</Button>
        </div>
      </Card>
    </DashboardShell>
  );
}
