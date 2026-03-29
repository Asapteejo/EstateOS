export const adminMetrics = [
  { label: "Total inquiries", value: "128", delta: "+12.5%" },
  { label: "Inspections booked", value: "34", delta: "+8.2%" },
  { label: "Reservations made", value: "16", delta: "+4.1%" },
  { label: "Active deals", value: "11", delta: "+6.8%" },
  { label: "Overdue payments", value: "3", delta: "-1.2%" },
  { label: "Total sales value", value: "₦1.84B", delta: "+14.9%" },
];

export const adminTables = {
  inquiries: [
    { lead: "Chinwe Obasi", property: "Eko Atrium Residences", source: "Website", status: "New", owner: "Amina Bello" },
    { lead: "David Cole", property: "Ikoyi Garden Villas", source: "Referral", status: "Qualified", owner: "Tobi Adeyemi" },
  ],
  bookings: [
    { client: "Maryam Yusuf", property: "Eko Atrium Residences", date: "Apr 02, 2026", status: "Confirmed" },
    { client: "Samuel Udo", property: "Asokoro Rise Terraces", date: "Apr 05, 2026", status: "Pending" },
  ],
  clients: [
    { name: "Ada Okafor", stage: "Allocation in progress", assigned: "Tobi Adeyemi", kyc: "Approved" },
    { name: "Kunle Adebayo", stage: "Legal verification", assigned: "Ifeoma Udeh", kyc: "Reviewing" },
  ],
  transactions: [
    { ref: "TXN-0018", property: "Eko Atrium Residences", buyer: "Ada Okafor", status: "Active", balance: "₦24.5M" },
    { ref: "TXN-0014", property: "Ikoyi Garden Villas", buyer: "Maryam Yusuf", status: "Contract issued", balance: "₦80M" },
  ],
  payments: [
    { ref: "PAY-11082", buyer: "Ada Okafor", amount: "₦12,500,000", status: "Success", method: "Paystack" },
    { ref: "PAY-11051", buyer: "Kunle Adebayo", amount: "₦8,000,000", status: "Pending", method: "Bank transfer" },
  ],
  documents: [
    { file: "passport-photo.jpg", owner: "Ada Okafor", type: "KYC", status: "Approved" },
    { file: "signed-contract.pdf", owner: "Maryam Yusuf", type: "Contract", status: "Reviewing" },
  ],
  audit: [
    { actor: "Tobi Adeyemi", action: "Updated milestone", target: "TXN-0018", time: "2026-03-28 14:20" },
    { actor: "Ifeoma Udeh", action: "Reviewed document", target: "DOC-1042", time: "2026-03-28 10:04" },
  ],
};
