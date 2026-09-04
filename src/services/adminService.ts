import { supabase } from "@/lib/supabase";
import {
  clearLegacyCentralBusinessRawStorage,
} from "@/services/centralBusinessStorageRuntime";

export type AdminAccount = {
  profile_id: string;
  full_name: string;
  email: string;
  role_level: string;
  unit: string;
  department: string | null;
  manager_name: string | null;
  auth_user_id: string | null;
  auth_email: string | null;
  auth_created_at: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  account_status:
    | "NOT_INVITED"
    | "AUTH_LINK_CHECK"
    | "INVITED_NOT_CONFIRMED"
    | "ACTIVE";
};

export type BulkActivationResult = {
  profile_id: string;
  full_name: string;
  email: string;
  status:
    | "CREATED"
    | "REPAIRED"
    | "SKIPPED"
    | "FAILED";
  temporary_password: string | null;
  error: string | null;
};

export type AdminImpersonationResult = {
  success: boolean;
  action_link: string;
  admin: {
    profile_id: string;
    full_name: string;
    email: string;
  };
  target: {
    profile_id: string;
    full_name: string;
    email: string;
    role_level: string;
    unit: string;
  };
};

export const getAdminAccounts =
  async (): Promise<
    AdminAccount[]
  > => {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "admin_list_accounts"
      );

    if (
      error
    ) {
      throw error;
    }

    return (
      data ||
      []
    ) as AdminAccount[];
  };

const invokeAdminControl =
  async (
    body:
      Record<
        string,
        unknown
      >
  ) => {
    const {
      data,
      error,
    } =
      await supabase
        .functions
        .invoke(
          "admin-user-control",
          {
            body,
          }
        );

    if (
      error
    ) {
      throw error;
    }

    if (
      data &&
      typeof data ===
        "object" &&
      "error" in data &&
      data.error
    ) {
      throw new Error(
        String(
          data.error
        )
      );
    }

    return data;
  };

export const activateAccount =
  async (
    profileId:
      string,
    temporaryPassword:
      string
  ) =>
    invokeAdminControl({
      action:
        "activate_account",
      profile_id:
        profileId,
      temporary_password:
        temporaryPassword,
    });

export const activateAllAccounts =
  async (): Promise<{
    success: boolean;
    action: string;
    results:
      BulkActivationResult[];
  }> =>
    invokeAdminControl({
      action:
        "activate_all_accounts",
    });

export const sendAdminTestNotification =
  async (
    profileId:
      string
  ): Promise<{
    success: boolean;
    notification_id: string;
    recipient_email: string;
  }> =>
    invokeAdminControl({
      action:
        "send_test_notification",
      profile_id:
        profileId,
    });

export const startAdminImpersonation =
  async (
    profileId: string
  ): Promise<
    AdminImpersonationResult
  > => {
    const {
      data,
      error,
    } =
      await supabase
        .functions
        .invoke(
          "admin-impersonate",
          {
            body: {
              profile_id:
                profileId,
            },
          }
        );

    if (error) {
      throw error;
    }

    if (
      data &&
      typeof data ===
        "object" &&
      "error" in data &&
      data.error
    ) {
      throw new Error(
        String(data.error)
      );
    }

    if (
      !data ||
      typeof data !==
        "object" ||
      !("action_link" in data) ||
      !data.action_link
    ) {
      throw new Error(
        "Server tidak mengembalikan Login As link."
      );
    }

    return data as
      AdminImpersonationResult;
  };

export const resetAccountPassword =
  async (
    profileId:
      string,
    newPassword:
      string
  ) =>
    invokeAdminControl({
      action:
        "reset_password",
      profile_id:
        profileId,
      new_password:
        newPassword,
    });

type ResetFilePathRow = {
  file_id: string;
  storage_path: string;
};

const removeCentralBusinessFilesForReset =
  async () => {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "list_central_business_file_paths_for_reset"
      );

    if (
      error
    ) {
      throw error;
    }

    const rows =
      (
        data ||
        []
      ) as ResetFilePathRow[];

    const paths =
      rows
        .map(
          row =>
            row.storage_path
        )
        .filter(
          Boolean
        );

    const chunkSize =
      100;

    for (
      let index =
        0;
      index <
      paths.length;
      index +=
        chunkSize
    ) {
      const chunk =
        paths.slice(
          index,
          index +
            chunkSize
        );

      const {
        error:
          storageError,
      } =
        await supabase
          .storage
          .from(
            "business-files"
          )
          .remove(
            chunk
          );

      if (
        storageError
      ) {
        throw storageError;
      }
    }
  };

const resetErrorMessage = (
  error: unknown
) => {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error
  ) {
    return String(
      (
        error as {
          message?: unknown;
        }
      ).message ||
        "Unknown error"
    );
  }

  return String(
    error ||
      "Unknown error"
  );
};

const runGlobalResetStage =
  async <T>(
    stage:
      string,
    action:
      () =>
        Promise<T>
  ): Promise<T> => {
    try {
      return await action();
    } catch (
      error
    ) {
      throw new Error(
        `Global Reset gagal pada tahap "${stage}": ${resetErrorMessage(
          error
        )}`
      );
    }
  };

export const globalResetAllBusinessData =
  async () => {
    // 1) Reset established central modules + advance data epoch.
    const result =
      await runGlobalResetStage(
        "Core business reset",
        () =>
          invokeAdminControl({
            action:
              "global_reset",
          })
      );

    // 2) Clear in-app notification state immediately after the core reset.
    // This is intentionally early: even if a later storage/metadata step fails,
    // old UAT notifications must not survive the Global Reset.
    await runGlobalResetStage(
      "Notification cleanup",
      async () => {
        const {
          error,
        } =
          await supabase.rpc(
            "admin_clear_notification_state_for_global_reset"
          );

        if (
          error
        ) {
          throw error;
        }
      }
    );

    // 3) Remove private business-file objects.
    await runGlobalResetStage(
      "Business file cleanup",
      () =>
        removeCentralBusinessFilesForReset()
    );

    // 4) Reset centralized metadata / Target-RKAP / Broker-Agent / entities.
    await runGlobalResetStage(
      "Central business metadata reset",
      async () => {
        const {
          error,
        } =
          await supabase.rpc(
            "reset_central_business_data"
          );

        if (
          error
        ) {
          throw error;
        }
      }
    );

    // 5) Clear browser-side legacy business remnants.
    clearLegacyCentralBusinessRawStorage();

    return result;
  };
