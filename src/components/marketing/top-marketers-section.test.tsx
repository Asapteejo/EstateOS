import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TopMarketersSection } from "@/components/marketing/top-marketers-section";

test("public top marketers section exposes profile links without revenue figures", () => {
  const html = renderToStaticMarkup(
    <TopMarketersSection
      period="WEEKLY"
      periodHrefBuilder={(period) => `/properties?topMarketers=${period}`}
      leaderboard={[
        {
          id: "marketer_1",
          slug: "tobi-adewale",
          fullName: "Tobi Adewale",
          title: "Senior Marketer",
          avatarUrl: null,
          isActive: true,
          isPublished: true,
          score: 22,
          starRating: 4.6,
          rank: 1,
          summary: "2 closed deals • 3 successful payments • 4 linked reservations",
          metrics: {
            wishlistAdds: 1,
            qualifiedInquiries: 2,
            inspectionsHandled: 1,
            reservations: 4,
            successfulPayments: 3,
            completedDeals: 2,
          },
          period: "WEEKLY",
        },
      ]}
    />,
  );

  assert.match(html, /\/team\/tobi-adewale/);
  assert.match(html, /Weekly score/);
  assert.doesNotMatch(html, /Revenue/i);
  assert.doesNotMatch(html, /₦/i);
});
