"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";

/**
 * Contracts registers for /admin/contracts, on the shared DataTable:
 * sortable columns, search, pagination. The server page flattens service rows
 * into these serializable shapes and passes the server actions down as props
 * (Next serializes action references), so the send/regenerate forms keep
 * working exactly as before — just inside table cells.
 */

type ServerAction = (formData: FormData) => void | Promise<void>;

export type UploadedContractTableRow = {
  id: string;
  reference: string;
  buyer: string;
  property: string;
  fileName: string;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "BLOCKED";
  dateLabel: string;
  acceptedNote: string | null;
};

const STATUS_BADGE: Record<UploadedContractTableRow["status"], { label: string; tone: string }> = {
  PENDING: { label: "Uploaded", tone: "bg-[var(--sand-100)] text-[var(--ink-600)]" },
  ACTIVE: { label: "Sent", tone: "bg-blue-50 text-blue-700" },
  COMPLETED: { label: "Accepted", tone: "bg-emerald-50 text-emerald-700" },
  BLOCKED: { label: "Blocked", tone: "bg-red-50 text-red-700" },
};

export function UploadedContractsTable({
  rows,
  sendAction,
}: {
  rows: UploadedContractTableRow[];
  sendAction: ServerAction;
}) {
  const columns = useMemo<ColumnDef<UploadedContractTableRow, unknown>[]>(
    () => [
      {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => (
          <span className="font-medium text-[var(--ink-900)]">{row.original.reference}</span>
        ),
      },
      { accessorKey: "buyer", header: "Buyer" },
      {
        accessorKey: "property",
        header: "Property",
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate">{row.original.property}</span>
        ),
      },
      { accessorKey: "fileName", header: "File" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const badge = STATUS_BADGE[row.original.status] ?? STATUS_BADGE.PENDING;
          return (
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badge.tone}`}
            >
              {badge.label}
            </span>
          );
        },
      },
      { accessorKey: "dateLabel", header: "Date" },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const contract = row.original;
          if (contract.status === "PENDING") {
            return (
              <form action={sendAction}>
                <input type="hidden" name="signedAgreementId" value={contract.id} />
                <Button type="submit" size="sm" variant="outline">
                  Send to buyer
                </Button>
              </form>
            );
          }
          if (contract.status === "ACTIVE") {
            return <span className="text-xs text-[var(--ink-400)]">Awaiting acceptance</span>;
          }
          if (contract.status === "COMPLETED") {
            return <span className="text-xs text-emerald-600">{contract.acceptedNote}</span>;
          }
          return null;
        },
      },
    ],
    [sendAction],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search by reference, buyer, or property…"
      pageSize={25}
      emptyTitle="No contracts uploaded yet"
      emptyDescription="Use the form above to link a contract PDF to a transaction."
      frameless
    />
  );
}

export type GeneratedContractTableRow = {
  id: string;
  contractNumber: string;
  buyer: string;
  property: string;
  status: string;
  versionLabel: string;
  templateNote: string | null;
  documentId: string;
  transactionId: string | null;
  templateId: string | null;
  canRegenerate: boolean;
};

export function GeneratedContractsTable({
  rows,
  generateAction,
}: {
  rows: GeneratedContractTableRow[];
  generateAction: ServerAction;
}) {
  const columns = useMemo<ColumnDef<GeneratedContractTableRow, unknown>[]>(
    () => [
      {
        accessorKey: "contractNumber",
        header: "Contract",
        cell: ({ row }) => (
          <span className="font-medium text-[var(--ink-900)]">{row.original.contractNumber}</span>
        ),
      },
      { accessorKey: "buyer", header: "Buyer" },
      { accessorKey: "property", header: "Property" },
      { accessorKey: "status", header: "Status" },
      {
        accessorKey: "versionLabel",
        header: "Version",
        cell: ({ row }) => (
          <div>
            <div>{row.original.versionLabel}</div>
            {row.original.templateNote ? (
              <div className="text-xs text-[var(--ink-500)]">{row.original.templateNote}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const contract = row.original;
          return (
            <div className="flex justify-end gap-2">
              <a href={`/api/documents/${contract.documentId}/download?disposition=attachment`}>
                <Button size="sm" variant="outline">
                  Download
                </Button>
              </a>
              {contract.transactionId && contract.canRegenerate ? (
                <form action={generateAction}>
                  <input type="hidden" name="transactionId" value={contract.transactionId} />
                  <input type="hidden" name="forceRegenerate" value="true" />
                  <Button type="submit" size="sm" variant="outline">
                    Regenerate
                  </Button>
                </form>
              ) : null}
              {contract.transactionId && contract.templateId && contract.canRegenerate ? (
                <form action={generateAction}>
                  <input type="hidden" name="transactionId" value={contract.transactionId} />
                  <input type="hidden" name="forceRegenerate" value="true" />
                  <input type="hidden" name="templateId" value={contract.templateId} />
                  <input type="hidden" name="regeneratedFromContractId" value={contract.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Original template
                  </Button>
                </form>
              ) : null}
            </div>
          );
        },
      },
    ],
    [generateAction],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search generated contracts…"
      pageSize={25}
      emptyTitle="No generated contracts yet"
      emptyDescription="Use the generator above after contract settings are ready."
      frameless
    />
  );
}
