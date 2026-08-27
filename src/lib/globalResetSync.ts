import { supabase } from "@/lib/supabase";
import { store } from "@/services/store";

const LOCAL_EPOCH_KEY =
  "pertalife_global_data_epoch";

const LEGACY_MASTER_KEYS_TO_REMOVE = [
  "pertalife_brokers",
  "pertalife_broker_master_version",
  "pertalife_agents",
  "pertalife_agent_master_version",
];

type GlobalResetState = {
  data_epoch: number;
  last_global_reset_at:
    | string
    | null;
};

const readState =
  async (): Promise<GlobalResetState> => {
    const { data, error } =
      await supabase.rpc(
        "get_global_reset_state"
      );

    if (error) {
      throw error;
    }

    return data as GlobalResetState;
  };

const resetBrowserBusinessData =
  async () => {
    // Existing legacy reset clears UAT/business data and file caches.
    await store.resetDataDummy();

    // Final reset baseline:
    // keep only User Master + Product Master.
    LEGACY_MASTER_KEYS_TO_REMOVE.forEach(
      (key) =>
        localStorage.removeItem(
          key
        )
    );
  };

export const syncGlobalResetState =
  async (): Promise<boolean> => {
    const state =
      await readState();

    const currentEpoch =
      Number(
        state?.data_epoch || 1
      );

    const storedRaw =
      localStorage.getItem(
        LOCAL_EPOCH_KEY
      );

    if (!storedRaw) {
      if (
        state
          ?.last_global_reset_at
      ) {
        await resetBrowserBusinessData();

        localStorage.setItem(
          LOCAL_EPOCH_KEY,
          String(currentEpoch)
        );

        return true;
      }

      localStorage.setItem(
        LOCAL_EPOCH_KEY,
        String(currentEpoch)
      );

      return false;
    }

    const storedEpoch =
      Number(storedRaw);

    if (
      storedEpoch ===
      currentEpoch
    ) {
      return false;
    }

    await resetBrowserBusinessData();

    localStorage.setItem(
      LOCAL_EPOCH_KEY,
      String(currentEpoch)
    );

    return true;
  };
