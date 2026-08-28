import { supabase } from "@/lib/supabase";
import {
  BASELINE_BROKERS,
  BrokerMaster,
} from "@/data/brokerMasterData";
import {
  AgentMaster,
} from "@/data/agentMasterData";
import type {
  ProductMaster,
} from "@/types";

type ProductRow = {
  id: string;
  product_code: string;
  product_name: string;
  insurance_type: ProductMaster["insuranceType"];
  customer_category: ProductMaster["customerCategory"];
  status: ProductMaster["status"];
  effective_date: string | null;
  notes: string | null;
  source_version: string | null;
  created_at: string;
  updated_at: string;
};

type BrokerRow = {
  id: string;
  company_name: string;
  license_number: string | null;
  license_date: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  phone1: string | null;
  phone2: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  status: BrokerMaster["status"];
  source_period: string | null;
  source_name: string | null;
  created_at: string;
  updated_at: string;
};

type AgentRow = {
  id: string;
  agent_code: string;
  agent_name: string;
  insurance_company: string;
  license_number: string | null;
  license_date: string | null;
  license_expiry_date: string | null;
  email: string | null;
  status: AgentMaster["status"];
  source_period: string | null;
  source_name: string | null;
  created_at: string;
  updated_at: string;
};

const productFromRow = (
  row: ProductRow
): ProductMaster => ({
  id: row.id,
  productCode: row.product_code,
  productName: row.product_name,
  insuranceType: row.insurance_type,
  customerCategory: row.customer_category,
  status: row.status,
  effectiveDate: row.effective_date || "",
  notes: row.notes || undefined,
});

const brokerFromRow = (
  row: BrokerRow
): BrokerMaster => ({
  id: row.id,
  companyName: row.company_name,
  licenseNumber: row.license_number || "",
  licenseDate: row.license_date || "",
  address: row.address || "",
  city: row.city || "",
  postalCode: row.postal_code || "",
  phone1: row.phone1 || "",
  phone2: row.phone2 || "",
  fax: row.fax || "",
  email: row.email || "",
  website: row.website || "",
  status: row.status,
  sourcePeriod: row.source_period || "",
  sourceName: row.source_name || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const agentFromRow = (
  row: AgentRow
): AgentMaster => ({
  id: row.id,
  agentCode: row.agent_code,
  agentName: row.agent_name,
  insuranceCompany: row.insurance_company,
  licenseNumber: row.license_number || "",
  licenseDate: row.license_date || "",
  licenseExpiryDate: row.license_expiry_date || "",
  email: row.email || "",
  status: row.status,
  sourcePeriod: row.source_period || "",
  sourceName: row.source_name || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listCentralProducts() {
  const { data, error } = await supabase
    .from("master_products")
    .select("*")
    .order("product_name", {
      ascending: true,
    });

  if (error) throw error;

  return ((data || []) as ProductRow[]).map(
    productFromRow
  );
}

export async function listCentralBrokers() {
  const { data, error } = await supabase
    .from("master_brokers")
    .select("*")
    .order("company_name", {
      ascending: true,
    });

  if (error) throw error;

  return ((data || []) as BrokerRow[]).map(
    brokerFromRow
  );
}

export async function listCentralAgents() {
  const { data, error } = await supabase
    .from("master_agents")
    .select("*")
    .order("agent_name", {
      ascending: true,
    });

  if (error) throw error;

  return ((data || []) as AgentRow[]).map(
    agentFromRow
  );
}

export async function ensureCentralBrokerBaseline() {
  const { count, error: countError } =
    await supabase
      .from("master_brokers")
      .select("id", {
        count: "exact",
        head: true,
      });

  if (countError) throw countError;

  if ((count || 0) > 0) {
    return {
      bootstrapped: false,
      inserted: 0,
    };
  }

  const { data, error } = await supabase.rpc(
    "bootstrap_broker_master",
    {
      p_rows: BASELINE_BROKERS,
    }
  );

  if (error) throw error;

  return {
    bootstrapped: true,
    inserted: Number(data || 0),
  };
}

export async function replaceCentralBrokerBaseline() {
  const { data, error } = await supabase.rpc(
    "replace_broker_master_baseline",
    {
      p_rows: BASELINE_BROKERS,
    }
  );

  if (error) throw error;

  return Number(data || 0);
}

export async function saveCentralProduct(
  product: ProductMaster
) {
  const { data, error } = await supabase
    .from("master_products")
    .upsert(
      {
        id: product.id,
        product_code: product.productCode,
        product_name: product.productName,
        insurance_type: product.insuranceType,
        customer_category:
          product.customerCategory,
        status: product.status,
        effective_date:
          product.effectiveDate || null,
        notes: product.notes || null,
      },
      {
        onConflict: "id",
      }
    )
    .select("*")
    .single();

  if (error) throw error;

  return productFromRow(
    data as ProductRow
  );
}

export async function createCentralBroker(
  broker: BrokerMaster
) {
  const { data, error } = await supabase
    .from("master_brokers")
    .insert({
      id: broker.id,
      company_name: broker.companyName,
      license_number:
        broker.licenseNumber || null,
      license_date:
        broker.licenseDate || null,
      address: broker.address || null,
      city: broker.city || null,
      postal_code:
        broker.postalCode || null,
      phone1: broker.phone1 || null,
      phone2: broker.phone2 || null,
      fax: broker.fax || null,
      email: broker.email || null,
      website: broker.website || null,
      status: broker.status,
      source_period:
        broker.sourcePeriod || null,
      source_name:
        broker.sourceName || null,
    })
    .select("*")
    .single();

  if (error) throw error;

  return brokerFromRow(
    data as BrokerRow
  );
}

export async function updateCentralBroker(
  broker: BrokerMaster
) {
  const { data, error } = await supabase
    .from("master_brokers")
    .update({
      company_name: broker.companyName,
      license_number:
        broker.licenseNumber || null,
      license_date:
        broker.licenseDate || null,
      address: broker.address || null,
      city: broker.city || null,
      postal_code:
        broker.postalCode || null,
      phone1: broker.phone1 || null,
      phone2: broker.phone2 || null,
      fax: broker.fax || null,
      email: broker.email || null,
      website: broker.website || null,
      status: broker.status,
      source_period:
        broker.sourcePeriod || null,
      source_name:
        broker.sourceName || null,
    })
    .eq("id", broker.id)
    .select("*")
    .single();

  if (error) throw error;

  return brokerFromRow(
    data as BrokerRow
  );
}

export async function deleteCentralBroker(
  brokerId: string
) {
  const { error } = await supabase
    .from("master_brokers")
    .delete()
    .eq("id", brokerId);

  if (error) throw error;
}

export async function createCentralAgent(
  agent: AgentMaster
) {
  const { data, error } = await supabase
    .from("master_agents")
    .insert({
      id: agent.id,
      agent_code: agent.agentCode,
      agent_name: agent.agentName,
      insurance_company:
        agent.insuranceCompany,
      license_number:
        agent.licenseNumber || null,
      license_date:
        agent.licenseDate || null,
      license_expiry_date:
        agent.licenseExpiryDate || null,
      email: agent.email || null,
      status: agent.status,
      source_period:
        agent.sourcePeriod || null,
      source_name:
        agent.sourceName || null,
    })
    .select("*")
    .single();

  if (error) throw error;

  return agentFromRow(
    data as AgentRow
  );
}

export async function updateCentralAgent(
  agent: AgentMaster
) {
  const { data, error } = await supabase
    .from("master_agents")
    .update({
      agent_code: agent.agentCode,
      agent_name: agent.agentName,
      insurance_company:
        agent.insuranceCompany,
      license_number:
        agent.licenseNumber || null,
      license_date:
        agent.licenseDate || null,
      license_expiry_date:
        agent.licenseExpiryDate || null,
      email: agent.email || null,
      status: agent.status,
      source_period:
        agent.sourcePeriod || null,
      source_name:
        agent.sourceName || null,
    })
    .eq("id", agent.id)
    .select("*")
    .single();

  if (error) throw error;

  return agentFromRow(
    data as AgentRow
  );
}

export async function deleteCentralAgent(
  agentId: string
) {
  const { error } = await supabase
    .from("master_agents")
    .delete()
    .eq("id", agentId);

  if (error) throw error;
}

export function subscribeCentralMasterData(
  onChange: () => void
) {
  const channel = supabase
    .channel(
      `central-master-data-${crypto.randomUUID()}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "master_products",
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "master_brokers",
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "master_agents",
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
