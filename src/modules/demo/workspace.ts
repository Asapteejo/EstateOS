import { getPublicDemoDealBoard } from "@/modules/admin/deal-board";

export function getPublicDemoWorkspace() {
  return {
    company: {
      name: "Crestline Developments",
      region: "Lagos, Nigeria",
    },
    board: getPublicDemoDealBoard(),
    narrative: [
      {
        title: "Deals move visibly",
        body: "The board shows fresh leads, inspections, reserved buyers, and active payment deals in one operator view.",
      },
      {
        title: "Payments stay operational",
        body: "Each deal makes it obvious when to send the next request, what has been paid, and what balance is still open.",
      },
      {
        title: "Collections are actioned",
        body: "Overdue buyers surface with amount at risk, days overdue, and the latest follow-up state so collections do not disappear into WhatsApp threads.",
      },
    ],
  };
}
