import type {
  TargetEntry,
  TargetUploadBatch,
} from "@/types";

import {
  listCentralTargetBatches,
  listCentralTargets,
  publishCentralTargetBatch,
  subscribeCentralTargetData,
} from "@/services/targetService";

import { store } from "@/services/store";

type TargetRuntimeCache = {
  targets: TargetEntry[];
  batches: TargetUploadBatch[];
};

let cache:
  TargetRuntimeCache = {
    targets: [],
    batches: [],
  };

let installed = false;

let activeProfileId:
  string | null = null;

let unsubscribeRealtime:
  | (() => void)
  | null = null;

let refreshTimer:
  | number
  | null = null;

const notifyLegacySubscribers =
  () => {
    const candidate =
      store as unknown as {
        notify?: () => void;
      };

    candidate.notify?.();
  };

const sortTargets = (
  values: TargetEntry[]
) =>
  [...values].sort(
    (a, b) =>
      b.year - a.year ||
      a.userName.localeCompare(
        b.userName,
        "id"
      )
  );

const sortBatches = (
  values: TargetUploadBatch[]
) =>
  [...values].sort(
    (a, b) =>
      new Date(
        b.uploadedAt
      ).getTime() -
      new Date(
        a.uploadedAt
      ).getTime()
  );

export const refreshCentralTargetRuntime =
  async () => {
    const [
      targets,
      batches,
    ] =
      await Promise.all([
        listCentralTargets(),
        listCentralTargetBatches(),
      ]);

    cache = {
      targets:
        sortTargets(targets),

      batches:
        sortBatches(batches),
    };

    notifyLegacySubscribers();
  };

const scheduleRefresh =
  () => {
    if (
      refreshTimer !== null
    ) {
      window.clearTimeout(
        refreshTimer
      );
    }

    refreshTimer =
      window.setTimeout(
        () => {
          refreshTimer =
            null;

          refreshCentralTargetRuntime()
            .catch(
              error => {
                console.error(
                  "[Central Target] Realtime refresh gagal",
                  error
                );
              }
            );
        },
        300
      );
  };

const replaceCurrentYearOptimistic =
  (
    batch: TargetUploadBatch,
    entries: TargetEntry[]
  ) => {
    cache.targets =
      sortTargets([
        ...cache.targets.filter(
          target =>
            target.year !==
            batch.year
        ),
        ...entries,
      ]);

    cache.batches =
      sortBatches([
        batch,
        ...cache.batches,
      ]);

    notifyLegacySubscribers();
  };

const patchStoreRuntime =
  () => {
    if (installed) {
      return;
    }

    installed = true;

    // ----------------------------------------------------------
    // READ AUTHORITY
    // ----------------------------------------------------------
    // After this runtime is installed, Target/RKAP reads are
    // served only from the central Supabase snapshot.
    store.getTargets =
      () =>
        [...cache.targets];

    store.getTargetBatches =
      () =>
        [...cache.batches];

    // ----------------------------------------------------------
    // WRITE AUTHORITY
    // ----------------------------------------------------------
    // Keep the existing synchronous store facade temporarily so
    // the large TargetRkapPage does not need a risky rewrite in
    // this migration step.
    //
    // IMPORTANT:
    // - nothing is written to target localStorage;
    // - the authoritative write is the atomic server RPC;
    // - optimistic state is rolled back automatically by
    //   reloading the central snapshot if server validation fails.
    store.publishTargetBatch =
      (
        batch: TargetUploadBatch,
        entries: TargetEntry[]
      ) => {
        replaceCurrentYearOptimistic(
          batch,
          entries
        );

        void publishCentralTargetBatch(
          batch,
          entries
        )
          .then(
            async () => {
              await refreshCentralTargetRuntime();
            }
          )
          .catch(
            async error => {
              console.error(
                "[Central Target] Publish gagal",
                error
              );

              try {
                await refreshCentralTargetRuntime();
              } catch (
                refreshError
              ) {
                console.error(
                  "[Central Target] Rollback refresh gagal",
                  refreshError
                );
              }

              window.alert(
                error instanceof Error
                  ? `Publish Target ditolak server: ${error.message}`
                  : "Publish Target ditolak server."
              );
            }
          );
      };
  };

export const syncCentralTargetRuntime =
  async (
    profileId: string
  ) => {
    patchStoreRuntime();

    if (
      activeProfileId !==
      profileId
    ) {
      unsubscribeRealtime?.();

      unsubscribeRealtime =
        null;

      activeProfileId =
        profileId;
    }

    await refreshCentralTargetRuntime();

    if (
      !unsubscribeRealtime
    ) {
      unsubscribeRealtime =
        subscribeCentralTargetData(
          scheduleRefresh
        );
    }
  };

export const clearCentralTargetRuntime =
  () => {
    activeProfileId =
      null;

    unsubscribeRealtime?.();

    unsubscribeRealtime =
      null;

    if (
      refreshTimer !== null
    ) {
      window.clearTimeout(
        refreshTimer
      );

      refreshTimer =
        null;
    }

    cache = {
      targets: [],
      batches: [],
    };
  };
