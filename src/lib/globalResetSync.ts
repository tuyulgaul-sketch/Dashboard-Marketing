import { supabase } from "@/lib/supabase";
import { store } from "@/services/store";

const LOCAL_EPOCH_KEY =
  "pertalife_global_data_epoch";

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
      // On first deployment we do not erase current browser data
      // unless an actual global reset has already occurred.
      if (
        state
          ?.last_global_reset_at
      ) {
        await store.resetDataDummy();

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

    await store.resetDataDummy();

    localStorage.setItem(
      LOCAL_EPOCH_KEY,
      String(currentEpoch)
    );

    return true;
  };
