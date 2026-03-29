export function isBuyerOwnedTransactionRecord(input: {
  viewerCompanyId: string | null;
  viewerUserId: string | null;
  recordCompanyId?: string | null;
  recordUserId?: string | null;
}) {
  return Boolean(
    input.viewerCompanyId &&
      input.viewerUserId &&
      input.recordCompanyId === input.viewerCompanyId &&
      input.recordUserId === input.viewerUserId,
  );
}

export function isBuyerOwnedDocumentRecord(input: {
  viewerCompanyId: string | null;
  viewerUserId: string | null;
  documentUserId?: string | null;
  transactionCompanyId?: string | null;
  transactionUserId?: string | null;
}) {
  if (!input.viewerCompanyId || !input.viewerUserId) {
    return false;
  }

  if (input.documentUserId === input.viewerUserId) {
    return true;
  }

  return (
    input.transactionCompanyId === input.viewerCompanyId &&
    input.transactionUserId === input.viewerUserId
  );
}
