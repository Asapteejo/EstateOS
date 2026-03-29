export const buyerOverview = {
  completion: 78,
  outstandingBalance: 24500000,
  nextPaymentDue: "2026-04-12",
  activeReservation: "RSV-2026-00018",
  notificationsUnread: 3,
};

export const buyerTimeline = [
  { title: "Inquiry received", description: "Client intent captured and assigned to sales.", status: "completed", date: "2026-01-11" },
  { title: "KYC submitted", description: "Government ID and proof of address uploaded.", status: "completed", date: "2026-01-13" },
  { title: "Reservation fee paid", description: "Property held pending contract issuance.", status: "completed", date: "2026-01-15" },
  { title: "Contract issued", description: "Draft agreement sent to client vault.", status: "completed", date: "2026-01-18" },
  { title: "Allocation in progress", description: "Operations team finalizing unit allocation.", status: "active", date: "2026-03-26" },
  { title: "Legal verification", description: "Final review and execution workflow.", status: "pending", date: "Pending" },
  { title: "Final payment completed", description: "Balance settlement confirmation.", status: "pending", date: "Pending" },
  { title: "Handover completed", description: "Keys, packs, and final documents delivered.", status: "pending", date: "Pending" },
] as const;

export const buyerNotifications = [
  {
    title: "Allocation update",
    body: "Your unit allocation is being finalized by operations and legal.",
    time: "2h ago",
  },
  {
    title: "Receipt available",
    body: "A new receipt has been added to your document vault.",
    time: "Yesterday",
  },
  {
    title: "Document request",
    body: "Please upload a recent utility bill for address verification.",
    time: "2 days ago",
  },
];
