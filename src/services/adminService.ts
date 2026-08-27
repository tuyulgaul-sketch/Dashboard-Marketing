import { supabase } from "@/lib/supabase";

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

export const getAdminAccounts =
  async (): Promise<AdminAccount[]> => {
    const { data, error } =
      await supabase.rpc(
        "admin_list_accounts"
      );

    if (error) {
      throw error;
    }

    return (
      (data || []) as AdminAccount[]
    );
  };

const invokeAdminControl =
  async (
    body: Record<string, unknown>
  ) => {
    const { data, error } =
      await supabase.functions.invoke(
        "admin-user-control",
        { body }
      );

    if (error) {
      throw error;
    }

    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      data.error
    ) {
      throw new Error(
        String(data.error)
      );
    }

    return data;
  };

export const resetAccountPassword =
  async (
    profileId: string,
    newPassword: string
  ) =>
    invokeAdminControl({
      action: "reset_password",
      profile_id: profileId,
      new_password: newPassword,
    });

export const globalResetAllBusinessData =
  async () =>
    invokeAdminControl({
      action: "global_reset",
    });
