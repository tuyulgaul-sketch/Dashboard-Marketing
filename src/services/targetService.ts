import { supabase } from "@/lib/supabase";
import type {
  TargetEntry,
  TargetUploadBatch,
} from "@/types";

type TargetRpcRow = {
  batch_id: string;
  target_year: number;
  holder_profile_id: string;
  legacy_user_id: string;
  user_name: string;
  position: string;
  unit: string;
  department: string;

  annual_target_total: number | string;
  annual_target_new_business: number | string;
  annual_target_renewal: number | string;

  personal_target_total: number | string;
  personal_target_new_business: number | string;
  personal_target_renewal: number | string;

  monthly_new_business: Array<number | string>;
  monthly_renewal: Array<number | string>;

  notes: string | null;
  published_at: string;
  published_by_name: string;
};

type TargetBatchRpcRow = {
  id: string;
  target_year: number;
  filename: string;
  record_count: number;
  status: "Published" | "Superseded";
  notes: string | null;
  is_current: boolean;
  uploaded_by_name: string;
  uploaded_at: string;
};

type PublishTargetResponse = {
  batchId: string;
  year: number;
  recordCount: number;
  status: "Published";
  publishedBy: string;
};

const toNumber = (
  value: number | string | null | undefined
): number => {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value || 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

const normalizeUnitDepartment = (
  unitValue: string,
  departmentValue: string
): {
  unit: TargetEntry["unit"];
  department: TargetEntry["department"];
} => {
  const unit =
    String(unitValue || "")
      .trim();

  const department =
    String(departmentValue || "")
      .trim();

  const captiveDepartments =
    new Set([
      "Captive I",
      "Captive II",
      "Captive III",
    ]);

  const crmDepartments =
    new Set([
      "CRM I",
      "CRM II",
      "CRM III",
    ]);

  if (
    captiveDepartments.has(unit)
  ) {
    return {
      unit:
        "Captive Marketing",
      department:
        unit as TargetEntry["department"],
    };
  }

  if (
    crmDepartments.has(unit)
  ) {
    return {
      unit:
        "Corporate & Retail Marketing",
      department:
        unit as TargetEntry["department"],
    };
  }

  if (
    unit ===
      "Directorate Marketing"
  ) {
    return {
      unit:
        "Direktorat Pemasaran",
      department:
        "None",
    };
  }

  if (
    unit ===
      "Captive Marketing"
  ) {
    return {
      unit:
        "Captive Marketing",
      department:
        (
          captiveDepartments.has(
            department
          )
            ? department
            : "None"
        ) as TargetEntry["department"],
    };
  }

  if (
    unit ===
      "Corporate & Retail Marketing"
  ) {
    return {
      unit:
        "Corporate & Retail Marketing",
      department:
        (
          crmDepartments.has(
            department
          )
            ? department
            : "None"
        ) as TargetEntry["department"],
    };
  }

  return {
    unit:
      unit as TargetEntry["unit"],
    department:
      (
        department ||
        "None"
      ) as TargetEntry["department"],
  };
};

const targetFromRow = (
  row: TargetRpcRow
): TargetEntry => {
  const normalized =
    normalizeUnitDepartment(
      row.unit,
      row.department
    );

  return {
    id:
      `TRG-${row.target_year}-${row.legacy_user_id}`,

    year:
      Number(row.target_year),

    userId:
      row.legacy_user_id,

    userName:
      row.user_name,

    position:
      row.position,

    unit:
      normalized.unit,

    department:
      normalized.department,

    annualTargetTotal:
      toNumber(
        row.annual_target_total
      ),

    annualTargetNewBusiness:
      toNumber(
        row.annual_target_new_business
      ),

    annualTargetRenewal:
      toNumber(
        row.annual_target_renewal
      ),

    personalTargetTotal:
      toNumber(
        row.personal_target_total
      ),

    personalTargetNewBusiness:
      toNumber(
        row.personal_target_new_business
      ),

    personalTargetRenewal:
      toNumber(
        row.personal_target_renewal
      ),

    monthlyNewBusiness:
      (
        row.monthly_new_business ||
        []
      ).map(toNumber),

    monthlyRenewal:
      (
        row.monthly_renewal ||
        []
      ).map(toNumber),

    notes:
      row.notes ||
      undefined,

    publishedAt:
      row.published_at,

    publishedBy:
      row.published_by_name,
  };
};

const batchFromRow = (
  row: TargetBatchRpcRow
): TargetUploadBatch => ({
  id:
    row.id,

  year:
    Number(row.target_year),

  filename:
    row.filename,

  uploadedBy:
    row.uploaded_by_name,

  uploadedAt:
    row.uploaded_at,

  recordCount:
    Number(row.record_count),

  status:
    row.status ===
      "Published"
      ? "Published"
      : "Valid",

  notes:
    [
      row.notes || "",
      row.is_current
        ? "Current central batch"
        : "Superseded central batch",
    ]
      .filter(Boolean)
      .join(" · "),
});

export async function listCentralTargets(
  year?: number
): Promise<TargetEntry[]> {
  const { data, error } =
    await supabase.rpc(
      "list_current_marketing_targets",
      {
        p_year:
          year || null,
      }
    );

  if (error) {
    throw error;
  }

  return (
    (data || []) as TargetRpcRow[]
  ).map(
    targetFromRow
  );
}

export async function listCentralTargetBatches(
  year?: number
): Promise<TargetUploadBatch[]> {
  const { data, error } =
    await supabase.rpc(
      "list_marketing_target_batches",
      {
        p_year:
          year || null,
      }
    );

  if (error) {
    throw error;
  }

  return (
    (data || []) as TargetBatchRpcRow[]
  ).map(
    batchFromRow
  );
}

export async function publishCentralTargetBatch(
  batch: TargetUploadBatch,
  entries: TargetEntry[]
): Promise<PublishTargetResponse> {
  const payload =
    entries.map(
      entry => ({
        year:
          entry.year,

        userId:
          entry.userId,

        position:
          entry.position,

        annualTargetTotal:
          Number(
            entry.annualTargetTotal ||
            0
          ),

        annualTargetNewBusiness:
          Number(
            entry.annualTargetNewBusiness ||
            0
          ),

        annualTargetRenewal:
          Number(
            entry.annualTargetRenewal ||
            0
          ),

        personalTargetTotal:
          Number(
            entry.personalTargetTotal ||
            0
          ),

        personalTargetNewBusiness:
          Number(
            entry.personalTargetNewBusiness ||
            0
          ),

        personalTargetRenewal:
          Number(
            entry.personalTargetRenewal ||
            0
          ),

        monthlyNewBusiness:
          entry.monthlyNewBusiness.map(
            value =>
              Number(value || 0)
          ),

        monthlyRenewal:
          entry.monthlyRenewal.map(
            value =>
              Number(value || 0)
          ),

        notes:
          entry.notes || null,
      })
    );

  const { data, error } =
    await supabase.rpc(
      "publish_marketing_target_batch",
      {
        p_year:
          batch.year,

        p_filename:
          batch.filename,

        p_entries:
          payload,

        p_notes:
          batch.notes || null,
      }
    );

  if (error) {
    throw error;
  }

  const result =
    data as Record<
      string,
      unknown
    >;

  return {
    batchId:
      String(
        result.batchId ||
        ""
      ),

    year:
      Number(
        result.year ||
        batch.year
      ),

    recordCount:
      Number(
        result.recordCount ||
        entries.length
      ),

    status:
      "Published",

    publishedBy:
      String(
        result.publishedBy ||
        batch.uploadedBy
      ),
  };
}

export function subscribeCentralTargetData(
  onChange: () => void
) {
  const channel =
    supabase
      .channel(
        `central-target-${crypto.randomUUID()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "marketing_target_batches",
        },
        onChange
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "marketing_targets",
        },
        onChange
      )
      .subscribe();

  return () => {
    void supabase.removeChannel(
      channel
    );
  };
}
