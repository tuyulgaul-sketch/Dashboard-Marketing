import type { AuthProfile } from "@/contexts/AuthContext";
import { store } from "@/services/store";
import {
  applyCentralBusinessChanges,
  bootstrapCentralBusinessCollection,
  CENTRAL_BUSINESS_STORAGE_KEYS,
  CentralBusinessStorageKey,
  CentralDeletePayload,
  CentralEntityRow,
  CentralUpsertPayload,
  isCentralBusinessStorageKey,
  listCentralBusinessEntities,
  subscribeCentralBusinessEntities,
} from "@/services/centralBusinessService";

type EntityPayload =
  Record<string, unknown>;

type CollectionMap =
  Map<
    CentralBusinessStorageKey,
    EntityPayload[]
  >;

type VersionMap =
  Map<string, number>;

const visibleCollections:
  CollectionMap =
  new Map();

const serverCollections:
  CollectionMap =
  new Map();

const versions:
  VersionMap =
  new Map();

const pendingByKey =
  new Map<
    CentralBusinessStorageKey,
    Promise<void>
  >();

const desiredByKey =
  new Map<
    CentralBusinessStorageKey,
    EntityPayload[]
  >();

const flushTimerByKey =
  new Map<
    CentralBusinessStorageKey,
    number
  >();

const BATCH_DEBOUNCE_MS =
  700;

let activeProfileId:
  string | null = null;

let unsubscribeRealtime:
  | (() => void)
  | null = null;

let realtimeTimer:
  | number
  | null = null;

let interceptorInstalled =
  false;

const originalGetItem =
  Storage.prototype.getItem;

const originalSetItem =
  Storage.prototype.setItem;

const originalRemoveItem =
  Storage.prototype.removeItem;

const versionKey = (
  storageKey:
    CentralBusinessStorageKey,
  id:
    string
) =>
  `${storageKey}::${id}`;

const cloneRows = (
  rows:
    EntityPayload[]
): EntityPayload[] =>
  rows.map(
    row => ({
      ...row,
    })
  );

const parseArray = (
  value:
    string | null
): EntityPayload[] => {
  if (
    !value
  ) {
    return [];
  }

  const parsed =
    JSON.parse(
      value
    );

  if (
    !Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      "Central business state harus berupa array."
    );
  }

  return parsed.filter(
    item =>
      item &&
      typeof item ===
        "object" &&
      !Array.isArray(
        item
      )
  ) as EntityPayload[];
};

const serializeArray = (
  rows:
    EntityPayload[]
) =>
  JSON.stringify(
    rows
  );

const getEntityId = (
  row:
    EntityPayload
) =>
  String(
    row.id || ""
  ).trim();

const notifyLegacySubscribers =
  () => {
    const candidate =
      store as unknown as {
        notify?: () => void;
      };

    candidate.notify?.();
  };

const rowsById = (
  rows:
    EntityPayload[]
) => {
  const result =
    new Map<
      string,
      EntityPayload
    >();

  rows.forEach(
    row => {
      const id =
        getEntityId(
          row
        );

      if (
        id
      ) {
        result.set(
          id,
          row
        );
      }
    }
  );

  return result;
};

const samePayload = (
  first:
    EntityPayload,
  second:
    EntityPayload
) =>
  JSON.stringify(
    first
  ) ===
  JSON.stringify(
    second
  );

const buildChanges = (
  storageKey:
    CentralBusinessStorageKey,
  confirmedRows:
    EntityPayload[],
  desiredRows:
    EntityPayload[]
): {
  upserts:
    CentralUpsertPayload[];
  deletes:
    CentralDeletePayload[];
} => {
  const confirmed =
    rowsById(
      confirmedRows
    );

  const desired =
    rowsById(
      desiredRows
    );

  const upserts:
    CentralUpsertPayload[] =
    [];

  const deletes:
    CentralDeletePayload[] =
    [];

  desired.forEach(
    (
      payload,
      id
    ) => {
      const previous =
        confirmed.get(
          id
        );

      if (
        !previous ||
        !samePayload(
          previous,
          payload
        )
      ) {
        upserts.push({
          payload,
          expectedVersion:
            versions.get(
              versionKey(
                storageKey,
                id
              )
            ) || 0,
        });
      }
    }
  );

  confirmed.forEach(
    (
      _payload,
      id
    ) => {
      if (
        !desired.has(
          id
        )
      ) {
        deletes.push({
          id,
          expectedVersion:
            versions.get(
              versionKey(
                storageKey,
                id
              )
            ) || 0,
        });
      }
    }
  );

  return {
    upserts,
    deletes,
  };
};

const applyRowsFromServer = (
  rows:
    CentralEntityRow[]
) => {
  const grouped:
    CollectionMap =
    new Map();

  CENTRAL_BUSINESS_STORAGE_KEYS.forEach(
    key => {
      grouped.set(
        key,
        []
      );
    }
  );

  versions.clear();

  rows.forEach(
    row => {
      const key =
        row.storage_key;

      const list =
        grouped.get(
          key
        ) || [];

      list.push(
        row.payload
      );

      grouped.set(
        key,
        list
      );

      versions.set(
        versionKey(
          key,
          row.entity_id
        ),
        Number(
          row.version ||
          1
        )
      );
    }
  );

  CENTRAL_BUSINESS_STORAGE_KEYS.forEach(
    key => {
      const next =
        cloneRows(
          grouped.get(
            key
          ) || []
        );

      serverCollections.set(
        key,
        next
      );

      visibleCollections.set(
        key,
        cloneRows(
          next
        )
      );
    }
  );

  notifyLegacySubscribers();
};

export const refreshCentralBusinessRuntime =
  async () => {
    const rows =
      await listCentralBusinessEntities();

    applyRowsFromServer(
      rows
    );
  };

const scheduleRealtimeRefresh =
  () => {
    if (
      realtimeTimer !==
      null
    ) {
      window.clearTimeout(
        realtimeTimer
      );
    }

    realtimeTimer =
      window.setTimeout(
        () => {
          realtimeTimer =
            null;

          // Let a queued local mutation finish first.
          Promise.all(
            Array.from(
              pendingByKey.values()
            )
          )
            .catch(
              () => undefined
            )
            .finally(
              () => {
                void refreshCentralBusinessRuntime()
                  .catch(
                    error => {
                      console.error(
                        "[Central Business] realtime refresh gagal",
                        error
                      );
                    }
                  );
              }
            );
        },
        750
      );
  };

const syncDesiredCollection =
  async (
    storageKey:
      CentralBusinessStorageKey,
    desiredRows:
      EntityPayload[]
  ) => {
    const confirmed =
      serverCollections.get(
        storageKey
      ) || [];

    const {
      upserts,
      deletes,
    } =
      buildChanges(
        storageKey,
        confirmed,
        desiredRows
      );

    if (
      upserts.length ===
        0 &&
      deletes.length ===
        0
    ) {
      return;
    }

    await applyCentralBusinessChanges(
      storageKey,
      upserts,
      deletes
    );

    // Reload all authorized rows after the transaction so version numbers,
    // server-normalized metadata, duplicate constraints and RLS are reflected.
    await refreshCentralBusinessRuntime();
  };

const flushCollectionSync =
  (
    storageKey:
      CentralBusinessStorageKey
  ) => {
    const desiredRows =
      desiredByKey.get(
        storageKey
      );

    if (
      !desiredRows
    ) {
      return;
    }

    desiredByKey.delete(
      storageKey
    );

    const previous =
      pendingByKey.get(
        storageKey
      ) ||
      Promise.resolve();

    const task =
      previous
        .catch(
          () => undefined
        )
        .then(
          () =>
            syncDesiredCollection(
              storageKey,
              desiredRows
            )
        )
        .catch(
          async error => {
            console.error(
              `[Central Business] ${storageKey} gagal tersimpan`,
              error
            );

            try {
              await refreshCentralBusinessRuntime();
            } catch (
              refreshError
            ) {
              console.error(
                "[Central Business] rollback refresh gagal",
                refreshError
              );
            }

            window.alert(
              error instanceof Error
                ? `Perubahan ditolak database pusat: ${error.message}`
                : "Perubahan ditolak database pusat."
            );
          }
        )
        .finally(
          () => {
            if (
              pendingByKey.get(
                storageKey
              ) === task
            ) {
              pendingByKey.delete(
                storageKey
              );
            }

            if (
              desiredByKey.has(
                storageKey
              )
            ) {
              const timer =
                window.setTimeout(
                  () => {
                    flushTimerByKey.delete(
                      storageKey
                    );

                    flushCollectionSync(
                      storageKey
                    );
                  },
                  BATCH_DEBOUNCE_MS
                );

              flushTimerByKey.set(
                storageKey,
                timer
              );
            }
          }
        );

    pendingByKey.set(
      storageKey,
      task
    );
  };

const enqueueCollectionSync =
  (
    storageKey:
      CentralBusinessStorageKey,
    desiredRows:
      EntityPayload[]
  ) => {
    // Keep only the latest desired snapshot. Bulk importers may call
    // localStorage.setItem hundreds of times while building one collection;
    // debouncing collapses that burst into one RPC / one DB transaction.
    desiredByKey.set(
      storageKey,
      cloneRows(
        desiredRows
      )
    );

    const existingTimer =
      flushTimerByKey.get(
        storageKey
      );

    if (
      existingTimer !==
      undefined
    ) {
      window.clearTimeout(
        existingTimer
      );
    }

    const timer =
      window.setTimeout(
        () => {
          flushTimerByKey.delete(
            storageKey
          );

          flushCollectionSync(
            storageKey
          );
        },
        BATCH_DEBOUNCE_MS
      );

    flushTimerByKey.set(
      storageKey,
      timer
    );
  };


export const installCentralBusinessStorageInterceptor =
  () => {
    if (
      interceptorInstalled
    ) {
      return;
    }

    interceptorInstalled =
      true;

    Storage.prototype.getItem =
      function (
        key:
          string
      ): string | null {
        if (
          this ===
            window.localStorage &&
          isCentralBusinessStorageKey(
            key
          )
        ) {
          return serializeArray(
            visibleCollections.get(
              key
            ) || []
          );
        }

        return originalGetItem.call(
          this,
          key
        );
      };

    Storage.prototype.setItem =
      function (
        key:
          string,
        value:
          string
      ): void {
        if (
          this ===
            window.localStorage &&
          isCentralBusinessStorageKey(
            key
          )
        ) {
          const desired =
            parseArray(
              value
            );

          visibleCollections.set(
            key,
            cloneRows(
              desired
            )
          );

          notifyLegacySubscribers();

          enqueueCollectionSync(
            key,
            cloneRows(
              desired
            )
          );

          return;
        }

        originalSetItem.call(
          this,
          key,
          value
        );
      };

    Storage.prototype.removeItem =
      function (
        key:
          string
      ): void {
        if (
          this ===
            window.localStorage &&
          isCentralBusinessStorageKey(
            key
          )
        ) {
          visibleCollections.set(
            key,
            []
          );

          notifyLegacySubscribers();

          enqueueCollectionSync(
            key,
            []
          );

          return;
        }

        originalRemoveItem.call(
          this,
          key
        );
      };
  };

const getLegacyLocalArray =
  (
    storageKey:
      CentralBusinessStorageKey
  ) => {
    try {
      const raw =
        originalGetItem.call(
          window.localStorage,
          storageKey
        );

      return parseArray(
        raw
      );
    } catch (
      error
    ) {
      console.warn(
        `[Central Business] legacy ${storageKey} tidak dapat dibaca`,
        error
      );

      return [];
    }
  };

const canBootstrap =
  (
    profile:
      AuthProfile
  ) =>
    (
      profile.legacy_user_id ||
      ""
    )
      .trim()
      .toUpperCase() ===
      "USR-000024";

const bootstrapLegacyCollections =
  async (
    profile:
      AuthProfile
  ) => {
    if (
      !canBootstrap(
        profile
      )
    ) {
      return;
    }

    for (
      const key of
      CENTRAL_BUSINESS_STORAGE_KEYS
    ) {
      const rows =
        getLegacyLocalArray(
          key
        );

      if (
        rows.length ===
        0
      ) {
        continue;
      }

      try {
        const inserted =
          await bootstrapCentralBusinessCollection(
            key,
            rows
          );

        if (
          inserted >
          0
        ) {
          console.info(
            `[Central Business] bootstrap ${key}: ${inserted} records`
          );
        }
      } catch (
        error
      ) {
        // Do not secretly fall back to local authority.
        // The collection remains central (possibly empty) and the issue
        // is visible in Console for the consolidated UAT.
        console.error(
          `[Central Business] bootstrap ${key} gagal`,
          error
        );
      }
    }
  };

export const syncCentralBusinessRuntime =
  async (
    profile:
      AuthProfile
  ) => {
    installCentralBusinessStorageInterceptor();

    if (
      activeProfileId !==
      profile.id
    ) {
      unsubscribeRealtime?.();

      unsubscribeRealtime =
        null;

      activeProfileId =
        profile.id;
    }

    await bootstrapLegacyCollections(
      profile
    );

    await refreshCentralBusinessRuntime();

    if (
      !unsubscribeRealtime
    ) {
      unsubscribeRealtime =
        subscribeCentralBusinessEntities(
          scheduleRealtimeRefresh
        );
    }
  };

export const clearCentralBusinessRuntime =
  () => {
    activeProfileId =
      null;

    unsubscribeRealtime?.();

    unsubscribeRealtime =
      null;

    if (
      realtimeTimer !==
      null
    ) {
      window.clearTimeout(
        realtimeTimer
      );

      realtimeTimer =
        null;
    }

    flushTimerByKey.forEach(
      timer =>
        window.clearTimeout(
          timer
        )
    );

    flushTimerByKey.clear();
    desiredByKey.clear();

    visibleCollections.clear();
    serverCollections.clear();
    versions.clear();
    pendingByKey.clear();
  };



export const clearLegacyCentralBusinessRawStorage =
  () => {
    CENTRAL_BUSINESS_STORAGE_KEYS.forEach(
      key => {
        originalRemoveItem.call(
          window.localStorage,
          key
        );
      }
    );
  };
