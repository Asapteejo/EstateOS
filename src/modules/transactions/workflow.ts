const TRANSACTION_STAGE_ORDER = [
  "INQUIRY_RECEIVED",
  "KYC_SUBMITTED",
  "RESERVATION_FEE_PAID",
  "CONTRACT_ISSUED",
  "ALLOCATION_IN_PROGRESS",
  "LEGAL_VERIFICATION",
  "FINAL_PAYMENT_COMPLETED",
  "HANDOVER_COMPLETED",
] as const;

const STAGE_TITLE_MAP: Record<(typeof TRANSACTION_STAGE_ORDER)[number], string> = {
  INQUIRY_RECEIVED: "Inquiry received",
  KYC_SUBMITTED: "KYC submitted",
  RESERVATION_FEE_PAID: "Reservation fee paid",
  CONTRACT_ISSUED: "Contract issued",
  ALLOCATION_IN_PROGRESS: "Allocation in progress",
  LEGAL_VERIFICATION: "Legal verification",
  FINAL_PAYMENT_COMPLETED: "Final payment completed",
  HANDOVER_COMPLETED: "Handover completed",
};

export type TransactionStageValue = (typeof TRANSACTION_STAGE_ORDER)[number];
export type ReservationStatusValue =
  | "PENDING"
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELLED"
  | "CONVERTED";

export function getStageIndex(stage: TransactionStageValue) {
  return TRANSACTION_STAGE_ORDER.indexOf(stage);
}

export function buildTransactionMilestoneState(
  currentStage: TransactionStageValue,
  now = new Date(),
) {
  const currentStageIndex = getStageIndex(currentStage);

  return TRANSACTION_STAGE_ORDER.map((stage, index) => {
    const isCompleted = index < currentStageIndex;
    const isActive = index === currentStageIndex;

    return {
      stage,
      title: STAGE_TITLE_MAP[stage],
      status: isCompleted ? "COMPLETED" : isActive ? "ACTIVE" : "PENDING",
      completedAt: isCompleted ? now : null,
    };
  });
}

export function deriveTransactionStageFromPayment(input: {
  currentStage: TransactionStageValue;
  outstandingBalanceBefore: number;
  paymentAmount: number;
}): TransactionStageValue {
  const outstandingAfter = Math.max(0, input.outstandingBalanceBefore - input.paymentAmount);

  if (outstandingAfter <= 0) {
    return "FINAL_PAYMENT_COMPLETED";
  }

  return getStageIndex(input.currentStage) >= getStageIndex("RESERVATION_FEE_PAID")
    ? input.currentStage
    : "RESERVATION_FEE_PAID";
}

export function calculateOutstandingBalance(
  outstandingBalanceBefore: number,
  paymentAmount: number,
) {
  return Math.max(0, outstandingBalanceBefore - paymentAmount);
}

export function canTransitionReservationStatus(
  currentStatus: ReservationStatusValue,
  nextStatus: ReservationStatusValue,
) {
  if (currentStatus === nextStatus) {
    return true;
  }

  const disallowed = new Set([
    "CANCELLED->ACTIVE",
    "EXPIRED->ACTIVE",
    "CONVERTED->PENDING",
    "CONVERTED->ACTIVE",
  ]);

  return !disallowed.has(`${currentStatus}->${nextStatus}`);
}

export function derivePropertyStatusFromReservationStatus(
  reservationStatus: ReservationStatusValue,
) {
  switch (reservationStatus) {
    case "ACTIVE":
    case "CONVERTED":
      return "RESERVED" as const;
    case "CANCELLED":
    case "EXPIRED":
      return "AVAILABLE" as const;
    default:
      return "AVAILABLE" as const;
  }
}

export function deriveOverallKycStatus(statuses: string[]) {
  if (statuses.length === 0) {
    return "NOT_SUBMITTED" as const;
  }

  if (statuses.some((status) => status === "REJECTED")) {
    return "REJECTED" as const;
  }

  if (statuses.some((status) => status === "CHANGES_REQUESTED")) {
    return "CHANGES_REQUESTED" as const;
  }

  if (statuses.every((status) => status === "APPROVED")) {
    return "APPROVED" as const;
  }

  if (statuses.some((status) => status === "UNDER_REVIEW")) {
    return "UNDER_REVIEW" as const;
  }

  return "SUBMITTED" as const;
}

export function getKycStatusTone(status: string) {
  switch (status) {
    case "APPROVED":
      return "success" as const;
    case "REJECTED":
    case "CHANGES_REQUESTED":
      return "danger" as const;
    case "UNDER_REVIEW":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}
