import { supabase } from "@/lib/supabase";

/**
 * VERSION 1 — SUPABASE LITE
 *
 * Only collections required by the six approved collaborative modules
 * are allowed to become cloud authority.
 *
 * Explicitly excluded:
 * Target/RKAP, Booking, Pipeline, Production, Policy Directory,
 * Historical Production, Participants and Reimbursement.
 */
export const CENTRAL_BUSINESS_STORAGE_KEYS = [
  "pertalife_service_documents",
  "pertalife_supporting_docs",
  "pertalife_marcomm_requests",
  "pertalife_marcomm_stock_transactions",
  "pertalife_marcomm_stock_opnames",
  "pertalife_audit_logs",
  "pertalife_notifications",
  "pertalife_document_handovers",
] as const;

export type CentralBusinessStorageKey =
  (typeof CENTRAL_BUSINESS_STORAGE_KEYS)[number];

export type CentralEntityRow = {
  storage_key: CentralBusinessStorageKey;
  entity_id: string;
  payload: Record<string, unknown>;
  relation_user_id: string | null;
  status: string | null;
  entity_year: number | null;
  dedupe_key: string | null;
  version: number;
  updated_at: string;
};

export type CentralUpsertPayload = {
  payload: Record<string, unknown>;
  expectedVersion: number;
};

export type CentralDeletePayload = {
  id: string;
  expectedVersion: number;
};

export const isCentralBusinessStorageKey = (
  value: string
): value is CentralBusinessStorageKey =>
  (
    CENTRAL_BUSINESS_STORAGE_KEYS as readonly string[]
  ).includes(value);

export async function listCentralBusinessEntities(
  storageKeys:
    CentralBusinessStorageKey[] =
      [...CENTRAL_BUSINESS_STORAGE_KEYS]
): Promise<CentralEntityRow[]> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "central_business_entities"
      )
      .select(
        "storage_key, entity_id, payload, relation_user_id, status, entity_year, dedupe_key, version, updated_at"
      )
      .in(
        "storage_key",
        storageKeys
      );

  if (error) {
    throw error;
  }

  return (
    data || []
  ) as CentralEntityRow[];
}

export async function bootstrapCentralBusinessCollection(
  storageKey:
    CentralBusinessStorageKey,
  rows:
    Record<string, unknown>[]
): Promise<number> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "bootstrap_central_business_collection",
      {
        p_storage_key:
          storageKey,
        p_rows:
          rows,
      }
    );

  if (error) {
    throw error;
  }

  return Number(
    data || 0
  );
}

export async function applyCentralBusinessChanges(
  storageKey:
    CentralBusinessStorageKey,
  upserts:
    CentralUpsertPayload[],
  deletes:
    CentralDeletePayload[]
): Promise<unknown> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "apply_central_business_changes",
      {
        p_storage_key:
          storageKey,
        p_upserts:
          upserts,
        p_deletes:
          deletes,
      }
    );

  if (error) {
    throw error;
  }

  return data;
}

export function subscribeCentralBusinessEntities(
  onChange:
    () => void
) {
  const channel =
    supabase
      .channel(
        `central-business-lite-${crypto.randomUUID()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "central_business_entities",
        },
        onChange
      )
      .subscribe();

  return () => {
    void supabase
      .removeChannel(
        channel
      );
  };
}
