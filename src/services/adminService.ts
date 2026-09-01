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

export const globalResetAllBusinessData =
  async () => {
    // Existing admin Edge Function resets the established central modules
    // and advances the global data epoch.
    const result =
      await invokeAdminControl({
        action:
          "global_reset",
      });

    // Final centralization additions:
    // remove physical private objects first, then reset their metadata,
    // Target/RKAP, Broker/Agent and the generic central business entities.
    await removeCentralBusinessFilesForReset();

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

    clearLegacyCentralBusinessRawStorage();

    // Global Reset must also clear transient in-app attention state.
    // Run this LAST so no notification created by earlier reset steps survives.
    const {
      error: notificationResetError,
    } = await supabase.rpc(
      "admin_clear_notification_state_for_global_reset"
    );

    if (
      notificationResetError
    ) {
      throw notificationResetError;
    }

    return result;
  };
