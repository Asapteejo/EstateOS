export type AttentionPriority = "high" | "medium" | "low";

export type AttentionState = {
  label: string;
  priority: AttentionPriority;
};

export function compareAttentionPriority(
  left: AttentionPriority | null | undefined,
  right: AttentionPriority | null | undefined,
) {
  return getAttentionPriorityWeight(right) - getAttentionPriorityWeight(left);
}

export function getAttentionTone(priority: AttentionPriority) {
  if (priority === "high") {
    return "danger" as const;
  }
  if (priority === "medium") {
    return "warning" as const;
  }
  return "info" as const;
}

function getAttentionPriorityWeight(priority: AttentionPriority | null | undefined) {
  if (priority === "high") {
    return 3;
  }
  if (priority === "medium") {
    return 2;
  }
  if (priority === "low") {
    return 1;
  }
  return 0;
}

export const workflowVocabulary = {
  inquiries: {
    statusLabels: {
      NEW: "New lead",
      CONTACTED: "Contacted",
      INSPECTION_BOOKED: "Inspection booked",
      QUALIFIED: "Qualified",
      CONVERTED: "Converted",
      CLOSED: "Closed",
      LOST: "Lost",
    },
    steps: ["New lead", "Contacted", "Inspection booked", "Qualified"],
    bulkActions: {
      CONTACTED: {
        label: "Mark contacted",
        confirmation: "mark the selected leads as Contacted",
      },
      QUALIFIED: {
        label: "Qualify lead",
        confirmation: "move the selected leads to Qualified",
      },
      INSPECTION_BOOKED: {
        label: "Book inspection",
        confirmation: "move the selected leads to Inspection booked",
      },
      assign_first_staff: {
        label: "Assign first staff",
        confirmation: "assign the first available staff member to the selected leads",
      },
    },
    quickActions: {
      CONTACTED: "Mark contacted",
      INSPECTION_BOOKED: "Book inspection",
      QUALIFIED: "Qualify lead",
    },
    attention({
      status,
      createdAt,
      assignedStaffId,
    }: {
      status: string;
      createdAt: string;
      assignedStaffId?: string | null;
    }): AttentionState | null {
      const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

      if (status === "NEW" && ageHours >= 24) {
        return { label: "Needs first contact", priority: "high" };
      }
      if (status === "CONTACTED" && !assignedStaffId) {
        return { label: "Owner not set", priority: "medium" };
      }
      if (status === "INSPECTION_BOOKED") {
        return { label: "Inspection follow-up active", priority: "low" };
      }
      if (status === "QUALIFIED") {
        return { label: "Advance or close out", priority: "medium" };
      }
      if (status === "CONVERTED") {
        return { label: "Converted", priority: "low" };
      }

      return null;
    },
    nextAction(status: string) {
      if (status === "NEW") {
        return "Assign an owner and complete first contact before the lead ages without response.";
      }
      if (status === "CONTACTED") {
        return "Confirm qualification or book an inspection while buyer intent is still warm.";
      }
      if (status === "INSPECTION_BOOKED") {
        return "Keep the owner and note current so the site-visit handoff stays clean.";
      }
      if (status === "QUALIFIED") {
        return "Advance this lead toward reservation or close-out before momentum drops.";
      }
      return "Capture the latest outcome so pipeline reporting stays reliable.";
    },
    lifecycleIndex(status: string) {
      if (status === "NEW") {
        return 0;
      }
      if (status === "CONTACTED") {
        return 1;
      }
      if (status === "INSPECTION_BOOKED") {
        return 2;
      }
      return 3;
    },
  },
  inspections: {
    statusLabels: {
      REQUESTED: "Visit requested",
      CONFIRMED: "Visit confirmed",
      RESCHEDULED: "Visit rescheduled",
      COMPLETED: "Visit completed",
      CANCELLED: "Cancelled",
      NO_SHOW: "No show",
    },
    steps: ["Visit requested", "Visit confirmed", "Visit rescheduled", "Visit completed"],
    bulkActions: {
      CONFIRMED: {
        label: "Confirm visit",
        confirmation: "confirm the selected visits",
      },
      COMPLETED: {
        label: "Mark completed",
        confirmation: "mark the selected visits as Completed visit",
      },
      assign_first_staff: {
        label: "Assign first staff",
        confirmation: "assign the first available staff member to the selected visits",
      },
    },
    quickActions: {
      CONFIRMED: "Confirm visit",
      RESCHEDULED: "Reschedule visit",
      COMPLETED: "Complete visit",
    },
    attention({
      status,
      scheduledFor,
    }: {
      status: string;
      scheduledFor: string;
    }): AttentionState | null {
      const scheduledAt = new Date(scheduledFor).getTime();
      const hoursUntilVisit = (scheduledAt - Date.now()) / (1000 * 60 * 60);

      if ((status === "REQUESTED" || status === "RESCHEDULED") && hoursUntilVisit <= 24) {
        return { label: "Confirm today", priority: "medium" };
      }
      if ((status === "CONFIRMED" || status === "RESCHEDULED") && hoursUntilVisit < 0) {
        return { label: "Visit overdue", priority: "high" };
      }
      if (status === "CONFIRMED" && hoursUntilVisit <= 6 && hoursUntilVisit >= -6) {
        return { label: "Visit today", priority: "low" };
      }
      if (status === "COMPLETED") {
        return { label: "Visit completed", priority: "low" };
      }

      return null;
    },
    nextAction(status: string) {
      if (status === "REQUESTED") {
        return "Confirm the owner and lock the visit window before the booking slips.";
      }
      if (status === "CONFIRMED") {
        return "Keep visit notes current so the assigned staff member has the right context.";
      }
      if (status === "RESCHEDULED") {
        return "Update the new slot and reschedule note so the team does not duplicate outreach.";
      }
      if (status === "COMPLETED") {
        return "Capture final notes and the next commercial step while the visit outcome is fresh.";
      }
      return "Keep visit status and owner aligned with the real-world outcome.";
    },
    lifecycleIndex(status: string) {
      if (status === "REQUESTED") {
        return 0;
      }
      if (status === "CONFIRMED") {
        return 1;
      }
      if (status === "RESCHEDULED") {
        return 2;
      }
      return 3;
    },
  },
  transactions: {
    stageLabels: {
      INQUIRY_RECEIVED: "Inquiry received",
      KYC_SUBMITTED: "KYC submitted",
      RESERVATION_FEE_PAID: "Reservation paid",
      CONTRACT_ISSUED: "Contract issued",
      ALLOCATION_IN_PROGRESS: "Allocation in progress",
      LEGAL_VERIFICATION: "Legal verification",
      FINAL_PAYMENT_COMPLETED: "Final payment completed",
      HANDOVER_COMPLETED: "Handover completed",
    },
    reservationStatusLabels: {
      PENDING: "Pending",
      ACTIVE: "Active",
      EXPIRED: "Expired",
      CANCELLED: "Cancelled",
      CONVERTED: "Converted",
    },
    steps: ["Inquiry", "Reservation paid", "Contract issued", "Final payment"],
    quickActions: {
      RESERVATION_FEE_PAID: "Mark reservation paid",
      CONTRACT_ISSUED: "Issue contract",
      FINAL_PAYMENT_COMPLETED: "Record final payment",
    },
    attention({
      stage,
      balance,
    }: {
      stage: string;
      balance: number;
    }): AttentionState | null {
      if (balance > 0 && stage !== "FINAL_PAYMENT_COMPLETED") {
        return { label: "Collections active", priority: "medium" };
      }
      if (stage === "CONTRACT_ISSUED" || stage === "ALLOCATION_IN_PROGRESS" || stage === "LEGAL_VERIFICATION") {
        return { label: "Documentation watch", priority: "low" };
      }
      if (stage === "FINAL_PAYMENT_COMPLETED") {
        return { label: "Ready for handover", priority: "low" };
      }

      return null;
    },
    nextAction({
      stage,
      balance,
    }: {
      stage: string;
      balance: number;
    }) {
      if (balance > 0 && stage !== "FINAL_PAYMENT_COMPLETED") {
        return "Outstanding balance remains. Confirm the next collections touchpoint before moving the deal forward.";
      }
      if (stage === "CONTRACT_ISSUED" || stage === "ALLOCATION_IN_PROGRESS") {
        return "Confirm legal and allocation readiness so the deal does not stall between documentation and delivery.";
      }
      if (stage === "HANDOVER_COMPLETED") {
        return "This deal is complete. Use notes only for final closure context or audit follow-up.";
      }
      return "Keep reservation and transaction status aligned so buyer-facing progress stays credible.";
    },
    lifecycleIndex(stage: string) {
      if (stage === "INQUIRY_RECEIVED" || stage === "KYC_SUBMITTED") {
        return 0;
      }
      if (stage === "RESERVATION_FEE_PAID") {
        return 1;
      }
      if (stage === "CONTRACT_ISSUED" || stage === "ALLOCATION_IN_PROGRESS" || stage === "LEGAL_VERIFICATION") {
        return 2;
      }
      return 3;
    },
  },
  clients: {
    followUpStatusLabels: {
      NONE: "New follow-up",
      PENDING_CALL: "Pending call",
      CONTACTED: "Contacted",
      FOLLOW_UP_SCHEDULED: "Follow-up scheduled",
      CLOSED: "Closed",
    },
    steps: ["New follow-up", "Pending call", "Follow-up scheduled", "Closed"],
    quickActions: {
      NONE: "Start follow-up",
      PENDING_CALL: "Set pending call",
      FOLLOW_UP_SCHEDULED: "Schedule follow-up",
      CLOSED: "Close follow-up",
    },
    attention({
      followUpStatus,
      assignedStaffId,
    }: {
      followUpStatus: string;
      assignedStaffId?: string | null;
    }): AttentionState | null {
      if (followUpStatus === "NONE") {
        return { label: "Needs first outreach", priority: "high" };
      }
      if (followUpStatus === "PENDING_CALL" && !assignedStaffId) {
        return { label: "Owner not set", priority: "medium" };
      }
      if (followUpStatus === "PENDING_CALL" || followUpStatus === "FOLLOW_UP_SCHEDULED") {
        return { label: "Follow-up active", priority: "low" };
      }
      if (followUpStatus === "CLOSED") {
        return { label: "Closed out", priority: "low" };
      }

      return null;
    },
    nextAction(followUpStatus: string) {
      if (followUpStatus === "NONE") {
        return "Assign an owner and set the first follow-up state while buyer intent is still fresh.";
      }
      if (followUpStatus === "PENDING_CALL") {
        return "Use WhatsApp or phone outreach next so the buyer does not stall after saving the property.";
      }
      if (followUpStatus === "FOLLOW_UP_SCHEDULED") {
        return "Keep the next touchpoint note current so the owner handoff stays clear.";
      }
      return "Capture the latest buyer outcome so follow-up reporting stays accurate.";
    },
    lifecycleIndex(followUpStatus: string) {
      if (followUpStatus === "NONE") {
        return 0;
      }
      if (followUpStatus === "PENDING_CALL" || followUpStatus === "CONTACTED") {
        return 1;
      }
      if (followUpStatus === "FOLLOW_UP_SCHEDULED") {
        return 2;
      }
      return 3;
    },
  },
  feasibility: {
    steps: ["Create", "Model", "Version", "Decision"],
    nextAction(versionNumber: number) {
      if (versionNumber > 1) {
        return "Open the workspace to refine the latest version, then move to decision view when pricing and timing are defensible.";
      }
      return "Continue modelling the first version until pricing, phasing, and recommendations are stable enough for decision review.";
    },
    lifecycleIndex(versionNumber: number) {
      return versionNumber > 1 ? 2 : 1;
    },
  },
} as const;
