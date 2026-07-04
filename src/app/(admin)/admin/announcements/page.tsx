import { DashboardShell } from "@/components/portal/dashboard-shell";
import { AnnouncementComposer } from "@/components/admin/announcement-composer";
import { AnnouncementList } from "@/components/admin/announcement-list";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { listAnnouncementsForAdmin } from "@/modules/announcements/service";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/announcements"));
  const rows = await listAnnouncementsForAdmin(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Announcements"
      subtitle="Broadcast notices to your buyers — shown at the top of their portal until dismissed or expired."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <AnnouncementComposer />
        <AnnouncementList rows={rows} />
      </div>
    </DashboardShell>
  );
}
