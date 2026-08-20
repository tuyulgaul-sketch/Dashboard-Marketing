export interface AgentMaster {
  id: string;
  agentCode: string;
  agentName: string;
  insuranceCompany: string;
  licenseNumber: string;
  licenseDate: string;
  licenseExpiryDate: string;
  email: string;
  status: 'Active' | 'Inactive';
  sourcePeriod: string;
  sourceName: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const AGENT_MASTER_VERSION = '2026-08-18-v1';

export const BASELINE_AGENTS: AgentMaster[] = [
  {
    id: "AGT-BASE-001",
    agentCode: "2400011",
    agentName: "GEMI AGUNG",
    insuranceCompany: "PT Perta Life Insurance",
    licenseNumber: "11070703",
    licenseDate: "2024-09-04",
    licenseExpiryDate: "2027-09-04",
    email: "gemi.pertalife@gmail.com",
    status: "Active",
    sourcePeriod: '18 Agustus 2026',
    sourceName: 'Daftar Agent 18082026',
  },
  {
    id: "AGT-BASE-002",
    agentCode: "2500002",
    agentName: "TEDI HERIANTO HAMIPRODJO",
    insuranceCompany: "PT Perta Life Insurance",
    licenseNumber: "14757608",
    licenseDate: "2025-10-09",
    licenseExpiryDate: "2027-10-09",
    email: "tedihh@gmail.com",
    status: "Active",
    sourcePeriod: '18 Agustus 2026',
    sourceName: 'Daftar Agent 18082026',
  },
  {
    id: "AGT-BASE-003",
    agentCode: "2300006",
    agentName: "MARIA MAGDALENA",
    insuranceCompany: "PT Perta Life Insurance",
    licenseNumber: "14773686",
    licenseDate: "2024-04-05",
    licenseExpiryDate: "2027-04-05",
    email: "lenalg1968@gmail.com",
    status: "Active",
    sourcePeriod: '18 Agustus 2026',
    sourceName: 'Daftar Agent 18082026',
  },
  {
    id: "AGT-BASE-004",
    agentCode: "2300002",
    agentName: "VINA OCTAVIANA",
    insuranceCompany: "PT Perta Life Insurance",
    licenseNumber: "14059047",
    licenseDate: "2021-06-27",
    licenseExpiryDate: "2027-06-27",
    email: "vinapertalife@gmail.com",
    status: "Active",
    sourcePeriod: '18 Agustus 2026',
    sourceName: 'Daftar Agent 18082026',
  },
  {
    id: "AGT-BASE-005",
    agentCode: "2200006",
    agentName: "SHABRINA AYUNINGTYAS",
    insuranceCompany: "PT Perta Life Insurance",
    licenseNumber: "15126378",
    licenseDate: "2024-07-21",
    licenseExpiryDate: "2027-07-21",
    email: "sabrinaaayu55@gmail.com",
    status: "Active",
    sourcePeriod: '18 Agustus 2026',
    sourceName: 'Daftar Agent 18082026',
  },
  {
    id: "AGT-BASE-006",
    agentCode: "2300013",
    agentName: "FITRI FEBRIAN",
    insuranceCompany: "PT Perta Life Insurance",
    licenseNumber: "15236980",
    licenseDate: "2023-10-12",
    licenseExpiryDate: "2027-10-12",
    email: "fitri.febrian@farazyprospera.com",
    status: "Active",
    sourcePeriod: '18 Agustus 2026',
    sourceName: 'Daftar Agent 18082026',
  },
  {
    id: "AGT-BASE-007",
    agentCode: "2400015",
    agentName: "ABDURRAHMAN HUMAAM",
    insuranceCompany: "PT Perta Life Insurance",
    licenseNumber: "16328495",
    licenseDate: "2024-10-28",
    licenseExpiryDate: "2027-10-28",
    email: "abdurrahmanhumampratama@gmail.com",
    status: "Active",
    sourcePeriod: '18 Agustus 2026',
    sourceName: 'Daftar Agent 18082026',
  },
  {
    id: "AGT-BASE-008",
    agentCode: "2600000",
    agentName: "FAJAR ABDUL HAFIZ ALDZAKY",
    insuranceCompany: "PT Perta Life Insurance",
    licenseNumber: "16416490",
    licenseDate: "2026-03-16",
    licenseExpiryDate: "2028-03-16",
    email: "fajarabdulhafizaldzaky@gmail.com",
    status: "Active",
    sourcePeriod: '18 Agustus 2026',
    sourceName: 'Daftar Agent 18082026',
  },
];
