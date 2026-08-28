import type { AuthProfile } from "@/contexts/AuthContext";
import type { ProductMaster } from "@/types";
import type {
  BrokerMaster,
} from "@/data/brokerMasterData";
import type {
  AgentMaster,
} from "@/data/agentMasterData";
import {
  createCentralAgent,
  createCentralBroker,
  deleteCentralAgent,
  deleteCentralBroker,
  listCentralAgents,
  listCentralBrokers,
  listCentralProducts,
  replaceCentralBrokerBaseline,
  saveCentralProduct,
  subscribeCentralMasterData,
  updateCentralAgent,
  updateCentralBroker,
} from "@/services/masterDataService";
import { store } from "@/services/store";

type RuntimeCache = {
  products: ProductMaster[];
  brokers: BrokerMaster[];
  agents: AgentMaster[];
};

let cache: RuntimeCache = {
  products: [],
  brokers: [],
  agents: [],
};

let installed = false;
let activeProfileId: string | null = null;
let unsubscribeRealtime:
  | (() => void)
  | null = null;

let refreshTimer:
  | number
  | null = null;

const notifyLegacySubscribers = () => {
  // Existing legacy pages subscribe through store.subscribe().
  // We deliberately reuse that notification channel during migration,
  // while the DATA authority itself now comes from Supabase.
  const candidate =
    store as unknown as {
      notify?: () => void;
    };

  candidate.notify?.();
};

const sortedProducts = (
  values: ProductMaster[]
) =>
  [...values].sort((a, b) =>
    a.productName.localeCompare(
      b.productName,
      "id"
    )
  );

const sortedBrokers = (
  values: BrokerMaster[]
) =>
  [...values].sort((a, b) =>
    a.companyName.localeCompare(
      b.companyName,
      "id"
    )
  );

const sortedAgents = (
  values: AgentMaster[]
) =>
  [...values].sort((a, b) =>
    a.agentName.localeCompare(
      b.agentName,
      "id"
    )
  );

const replaceProductInCache = (
  product: ProductMaster
) => {
  const next =
    cache.products.filter(
      item => item.id !== product.id
    );

  next.push(product);

  cache.products =
    sortedProducts(next);

  notifyLegacySubscribers();
};

const replaceBrokerInCache = (
  broker: BrokerMaster
) => {
  const next =
    cache.brokers.filter(
      item => item.id !== broker.id
    );

  next.push(broker);

  cache.brokers =
    sortedBrokers(next);

  notifyLegacySubscribers();
};

const replaceAgentInCache = (
  agent: AgentMaster
) => {
  const next =
    cache.agents.filter(
      item => item.id !== agent.id
    );

  next.push(agent);

  cache.agents =
    sortedAgents(next);

  notifyLegacySubscribers();
};

const reportMutationError = (
  label: string,
  error: unknown
) => {
  console.error(
    `[Central Master] ${label} gagal`,
    error
  );

  window.alert(
    error instanceof Error
      ? error.message
      : `${label} gagal disimpan ke database pusat.`
  );
};

const refreshCentralMasterCache =
  async () => {
    const [
      products,
      brokers,
      agents,
    ] = await Promise.all([
      listCentralProducts(),
      listCentralBrokers(),
      listCentralAgents(),
    ]);

    cache = {
      products:
        sortedProducts(products),
      brokers:
        sortedBrokers(brokers),
      agents:
        sortedAgents(agents),
    };

    notifyLegacySubscribers();
  };

const scheduleCentralRefresh = () => {
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

        refreshCentralMasterCache()
          .catch(error => {
            console.error(
              "[Central Master] Realtime refresh gagal",
              error
            );
          });
      },
      300
    );
};

const patchStoreRuntime = () => {
  if (installed) {
    return;
  }

  installed = true;

  // ----------------------------------------------------------------
  // READS
  // ----------------------------------------------------------------
  // Existing feature pages may keep calling the legacy synchronous
  // facade during migration, but these methods no longer read
  // localStorage. They return the in-memory snapshot loaded from
  // the central Supabase tables before protected pages are rendered.
  store.getProducts = () =>
    [...cache.products];

  store.getBrokers = () =>
    [...cache.brokers];

  store.getAgents = () =>
    [...cache.agents];

  // ----------------------------------------------------------------
  // PRODUCT WRITE
  // ----------------------------------------------------------------
  store.saveProduct = (
    product: ProductMaster
  ) => {
    void saveCentralProduct(product)
      .then(
        replaceProductInCache
      )
      .catch(error =>
        reportMutationError(
          "Master Product",
          error
        )
      );
  };

  // ----------------------------------------------------------------
  // BROKER WRITES
  // ----------------------------------------------------------------
  store.addBroker = (
    broker: BrokerMaster
  ) => {
    void createCentralBroker(broker)
      .then(
        replaceBrokerInCache
      )
      .catch(error =>
        reportMutationError(
          "Tambah Master Broker",
          error
        )
      );
  };

  store.updateBroker = (
    broker: BrokerMaster
  ) => {
    void updateCentralBroker(broker)
      .then(
        replaceBrokerInCache
      )
      .catch(error =>
        reportMutationError(
          "Update Master Broker",
          error
        )
      );
  };

  store.setBrokerStatus = (
    brokerId: string,
    status:
      | "Active"
      | "Inactive"
  ) => {
    const broker =
      cache.brokers.find(
        item =>
          item.id === brokerId
      );

    if (!broker) {
      window.alert(
        "Broker tidak ditemukan pada database pusat."
      );

      return;
    }

    void updateCentralBroker({
      ...broker,
      status,
    })
      .then(
        replaceBrokerInCache
      )
      .catch(error =>
        reportMutationError(
          "Status Master Broker",
          error
        )
      );
  };

  store.deleteBroker = (
    brokerId: string
  ) => {
    void deleteCentralBroker(
      brokerId
    )
      .then(() => {
        cache.brokers =
          cache.brokers.filter(
            item =>
              item.id !== brokerId
          );

        notifyLegacySubscribers();
      })
      .catch(error =>
        reportMutationError(
          "Hapus Master Broker",
          error
        )
      );
  };

  store.restoreBaselineBrokerMaster =
    () => {
      void replaceCentralBrokerBaseline()
        .then(
          async () => {
            cache.brokers =
              sortedBrokers(
                await listCentralBrokers()
              );

            notifyLegacySubscribers();
          }
        )
        .catch(error =>
          reportMutationError(
            "Restore baseline Master Broker",
            error
          )
        );
    };

  // ----------------------------------------------------------------
  // AGENT WRITES
  // ----------------------------------------------------------------
  store.addAgent = (
    agent: AgentMaster
  ) => {
    void createCentralAgent(agent)
      .then(
        replaceAgentInCache
      )
      .catch(error =>
        reportMutationError(
          "Tambah Master Agent",
          error
        )
      );
  };

  store.updateAgent = (
    agent: AgentMaster
  ) => {
    void updateCentralAgent(agent)
      .then(
        replaceAgentInCache
      )
      .catch(error =>
        reportMutationError(
          "Update Master Agent",
          error
        )
      );
  };

  store.setAgentStatus = (
    agentId: string,
    status:
      | "Active"
      | "Inactive"
  ) => {
    const agent =
      cache.agents.find(
        item =>
          item.id === agentId
      );

    if (!agent) {
      window.alert(
        "Agent tidak ditemukan pada database pusat."
      );

      return;
    }

    void updateCentralAgent({
      ...agent,
      status,
    })
      .then(
        replaceAgentInCache
      )
      .catch(error =>
        reportMutationError(
          "Status Master Agent",
          error
        )
      );
  };

  store.deleteAgent = (
    agentId: string
  ) => {
    void deleteCentralAgent(
      agentId
    )
      .then(() => {
        cache.agents =
          cache.agents.filter(
            item =>
              item.id !== agentId
          );

        notifyLegacySubscribers();
      })
      .catch(error =>
        reportMutationError(
          "Hapus Master Agent",
          error
        )
      );
  };
};

/**
 * Installs the central Product/Broker/Agent runtime before protected pages
 * render. The legacy store remains only a compatibility API surface.
 *
 * IMPORTANT:
 * - No master-data read below uses localStorage after this function installs.
 * - No Product/Broker/Agent mutation writes localStorage after installation.
 * - Supabase RLS remains the real authorization boundary.
 */
export const syncCentralMasterRuntime =
  async (
    profile: AuthProfile
  ) => {
    patchStoreRuntime();

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


    // Final centralization: no automatic Broker re-bootstrap.
    // This preserves the canonical Global Reset baseline (User + Product only).
    // Broker/Agent restoration must be an explicit authorized action.
    await refreshCentralMasterCache();

    if (
      !unsubscribeRealtime
    ) {
      unsubscribeRealtime =
        subscribeCentralMasterData(
          scheduleCentralRefresh
        );
    }
  };

export const clearCentralMasterRuntime =
  () => {
    activeProfileId = null;

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
      products: [],
      brokers: [],
      agents: [],
    };
  };
