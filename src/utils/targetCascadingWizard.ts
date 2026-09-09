import type { TargetEntry, User } from '@/types';
import { parseExactTargetRupiah } from './targetCompact';
import { calculateTargetSetup, targetSetupHolders, type TargetKind, type TargetDraft } from './targetOnScreen';

export type Amounts = { NB: string; RN: string };
export type Months = { NB: string[]; RN: string[] };
export type Allocation = { team: Amounts; teamMonths: Months; personal: Amounts; personalMonths: Months; notes: string };
export type WizardState = { allocations: Record<string, Allocation>; accepted: string[] };
export type WizardNode = { user: User; children: string[]; depth: number };
export type WizardTree = { root: string; nodes: Record<string, WizardNode>; order: string[] };
export type Phase = 'team' | 'teamMonths' | 'personal' | 'personalMonths';
export type WizardStep = { id: string; phase: Phase; automatic: boolean; parent?: string; lastChild: boolean };
export const KINDS: TargetKind[] = ['NB', 'RN'];
export const ZERO: Amounts = { NB: '0', RN: '0' };
export const blankMonths = (): Months => ({ NB: Array(12).fill(''), RN: Array(12).fill('') });
export const blankAllocation = (): Allocation => ({ team: { NB: '', RN: '' }, teamMonths: zeroMonths(), personal: { NB: '0', RN: '0' }, personalMonths: zeroMonths(), notes: '' });
const exact = (raw: unknown, label: string) => { try { return parseExactTargetRupiah(raw); } catch (error) { throw new Error(`${label}: ${error instanceof Error ? error.message : 'Angka tidak valid.'}`); } };
const safe = (value: number, label: string) => { if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label}: jumlah negatif atau melebihi batas rupiah presisi.`); return value; };
export const parseAmounts = (value: Amounts, label: string): Amounts => ({ NB: String(exact(value.NB, `${label} NB`)), RN: String(exact(value.RN, `${label} RN`)) });
export const addAmounts = (a: Amounts, b: Amounts, label = 'Jumlah'): Amounts => ({ NB: String(safe(exact(a.NB, label) + exact(b.NB, label), label)), RN: String(safe(exact(a.RN, label) + exact(b.RN, label), label)) });
export const subtractAmounts = (a: Amounts, b: Amounts, label = 'Sisa'): Amounts => ({ NB: String(safe(exact(a.NB, label) - exact(b.NB, label), label)), RN: String(safe(exact(a.RN, label) - exact(b.RN, label), label)) });
export const sameAmounts = (a: Amounts, b: Amounts) => KINDS.every(kind => exact(a[kind], kind) === exact(b[kind], kind));
export const parseMonths = (value: Months, label: string): Months => ({ NB: parseMonthValues(value.NB, `${label} NB`), RN: parseMonthValues(value.RN, `${label} RN`) });
const parseMonthValues = (values: string[], label: string) => { if (!Array.isArray(values) || values.length !== 12) throw new Error(`${label}: wajib tepat 12 bulan.`); return values.map((value, i) => String(exact(value, `${label} bulan ${i + 1}`))); };
export const sumMonths = (values: Months, label = 'Bulanan'): Amounts => { const parsed = parseMonths(values, label); return { NB: String(parsed.NB.reduce((a, b) => safe(a + Number(b), label), 0)), RN: String(parsed.RN.reduce((a, b) => safe(a + Number(b), label), 0)) }; };
export const validateMonths = (values: Months, annual: Amounts, label: string): Months => { const parsed = parseMonths(values, label); if (!sameAmounts(sumMonths(parsed, label), annual)) throw new Error(`${label}: jumlah 12 bulan NB dan RN harus sama persis dengan target tahunan.`); return parsed; };
export const addMonths = (a: Months, b: Months, label = 'Bulanan'): Months => ({ NB: a.NB.map((v, i) => String(safe(exact(v, label) + exact(b.NB[i], label), label))), RN: a.RN.map((v, i) => String(safe(exact(v, label) + exact(b.RN[i], label), label))) });
export const subtractMonths = (a: Months, b: Months, label = 'Sisa bulanan'): Months => ({ NB: a.NB.map((v, i) => String(safe(exact(v, label) - exact(b.NB[i], label), `${label} bulan ${i + 1} NB`))), RN: a.RN.map((v, i) => String(safe(exact(v, label) - exact(b.RN[i], label), `${label} bulan ${i + 1} RN`))) });
export const sameMonths = (a: Months, b: Months) => KINDS.every(kind => a[kind].length === 12 && b[kind].length === 12 && a[kind].every((v, i) => exact(v, kind) === exact(b[kind][i], kind)));
export const zeroMonths = (): Months => ({ NB: Array(12).fill('0'), RN: Array(12).fill('0') });
const ROLE_ORDER: Record<string, number> = { DIRECTOR_MARKETING: 0, VP_CAPTIVE_MARKETING: 1, VP_CORPORATE_RETAIL_MARKETING: 2, ADVISOR_MARKETING_DIRECTOR: 3, DEPARTMENT_HEAD_MARKETING: 4, SUPERVISOR_MARKETING: 5, STAFF_MARKETING: 6 };
const DEPARTMENT_ORDER: Record<string, number> = { 'Captive I': 1, 'Captive II': 2, 'Captive III': 3, 'CRM I': 4, 'CRM II': 5, 'CRM III': 6 };
export const buildWizardTree = (users: User[]): WizardTree => {
  const holders = targetSetupHolders(users); const directors = holders.filter(u => u.role === 'DIRECTOR_MARKETING');
  if (directors.length !== 1) throw new Error('User Master harus memiliki tepat satu Direktur Marketing aktif.');
  const root = directors[0].id; const nodes: Record<string, WizardNode> = {};
  for (const user of holders) { if (nodes[user.id]) throw new Error(`User ID duplikat: ${user.id}.`); nodes[user.id] = { user, children: [], depth: 0 }; }
  for (const user of holders) {
    if (user.id === root) { if (user.superiorId && nodes[user.superiorId]) throw new Error('Direktur Marketing tidak boleh berada di bawah pemilik target lain.'); continue; }
    if (!user.superiorId || !nodes[user.superiorId]) throw new Error(`Atasan ${user.name} (${user.id}) tidak terhubung ke pemilik target aktif. Perbaiki User Master.`);
    nodes[user.superiorId].children.push(user.id);
  }
  const order: string[] = []; const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string, depth: number) => {
    if (visiting.has(id)) throw new Error(`Siklus struktur atasan terdeteksi pada ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id); nodes[id].depth = depth;
    nodes[id].children.sort((a, b) => { const x = nodes[a].user, y = nodes[b].user; return (ROLE_ORDER[x.role] ?? 99) - (ROLE_ORDER[y.role] ?? 99) || (DEPARTMENT_ORDER[x.department] ?? 99) - (DEPARTMENT_ORDER[y.department] ?? 99) || x.name.localeCompare(y.name, 'id') || x.id.localeCompare(y.id); });
    order.push(id); nodes[id].children.forEach(child => visit(child, depth + 1)); visiting.delete(id); visited.add(id);
  };
  visit(root, 0); if (visited.size !== holders.length) throw new Error('Ada pemilik target yang tidak terhubung ke Direktur Marketing.');
  return { root, nodes, order };
};
export const buildSteps = (tree: WizardTree): WizardStep[] => tree.order.flatMap(id => {
  const user = tree.nodes[id].user; const parent = user.superiorId && tree.nodes[user.superiorId] ? user.superiorId : undefined;
  const lastChild = Boolean(parent && tree.nodes[parent].children[tree.nodes[parent].children.length - 1] === id); const leaf = tree.nodes[id].children.length === 0;
  const phases: Phase[] = ['team', 'teamMonths', 'personal', 'personalMonths'];
  return phases.map(phase => ({ id, phase, parent, lastChild, automatic: Boolean((lastChild && phase.startsWith('team')) || (leaf && phase.startsWith('personal'))) }));
});
export const seedWizard = (tree: WizardTree, targets: TargetEntry[]): WizardState => {
  const byId = new Map(targets.map(row => [row.userId, row])); const allocations: WizardState['allocations'] = {};
  for (const id of tree.order) { const row = byId.get(id); allocations[id] = row ? { team: { NB: String(row.annualTargetNewBusiness), RN: String(row.annualTargetRenewal) }, teamMonths: blankMonths(), personal: { NB: String(row.personalTargetNewBusiness), RN: String(row.personalTargetRenewal) }, personalMonths: { NB: row.monthlyNewBusiness.map(String), RN: row.monthlyRenewal.map(String) }, notes: row.notes || '' } : blankAllocation(); }
  // Reconstruct the monthly team budgets from the official personal schedules.
  for (const id of [...tree.order].reverse()) { const allocation = allocations[id]; allocation.teamMonths = tree.nodes[id].children.reduce((total, child) => addMonths(total, allocations[child].teamMonths), parseMonths(allocation.personalMonths, `${id} existing`)); }
  return { allocations, accepted: [] };
};
export const availableFor = (tree: WizardTree, state: WizardState, step: WizardStep): Amounts | Months | undefined => {
  if (!step.parent) return undefined;
  const parent = state.allocations[step.parent]; const siblings = tree.nodes[step.parent].children; const previous = siblings.slice(0, siblings.indexOf(step.id));
  if (step.phase === 'team') return previous.reduce((left, id) => subtractAmounts(left, state.allocations[id].team, 'Sisa tim'), subtractAmounts(parent.team, parent.personal, 'Sisa pribadi atasan'));
  if (step.phase === 'teamMonths') return previous.reduce((left, id) => subtractMonths(left, state.allocations[id].teamMonths, 'Sisa bulanan tim'), subtractMonths(parent.teamMonths, parent.personalMonths, 'Sisa bulanan pribadi atasan'));
  return undefined;
};
export const normalizeAutomatic = (tree: WizardTree, input: WizardState, index: number): WizardState => {
  const state = structuredClone(input); const steps = buildSteps(tree);
  for (let i = 0; i < index; i++) {
    const step = steps[i]; if (!step.automatic) continue; const allocation = state.allocations[step.id];
    if (step.phase === 'team') allocation.team = availableFor(tree, state, step) as Amounts;
    if (step.phase === 'teamMonths') allocation.teamMonths = availableFor(tree, state, step) as Months;
    if (step.phase === 'personal') allocation.personal = allocation.team;
    if (step.phase === 'personalMonths') allocation.personalMonths = allocation.teamMonths;
  }
  return state;
};
export const validateStep = (tree: WizardTree, state: WizardState, step: WizardStep): Allocation => {
  const allocation = structuredClone(state.allocations[step.id]); const label = `${tree.nodes[step.id].user.name} ${step.phase}`;
  if (step.phase === 'team') { allocation.team = parseAmounts(allocation.team, label); if (step.parent) subtractAmounts(availableFor(tree, state, step) as Amounts, allocation.team, label); }
  if (step.phase === 'teamMonths') { allocation.teamMonths = validateMonths(allocation.teamMonths, allocation.team, label); if (step.parent) subtractMonths(availableFor(tree, state, step) as Months, allocation.teamMonths, label); }
  if (step.phase === 'personal') { allocation.personal = parseAmounts(allocation.personal, label); subtractAmounts(allocation.team, allocation.personal, label); }
  if (step.phase === 'personalMonths') { allocation.personalMonths = validateMonths(allocation.personalMonths, allocation.personal, label); subtractMonths(allocation.teamMonths, allocation.personalMonths, label); }
  return allocation;
};
export const acceptStep = (tree: WizardTree, input: WizardState, index: number): WizardState => {
  const steps = buildSteps(tree); if (index < 0 || index >= steps.length || input.accepted.length !== index) throw new Error('Urutan wizard berubah. Mulai dari langkah yang belum selesai.');
  const state = normalizeAutomatic(tree, input, index + 1); const step = steps[index]; state.allocations[step.id] = validateStep(tree, state, step); state.accepted = steps.slice(0, index + 1).map(s => `${s.id}:${s.phase}`); return state;
};
export const validateWizard = (tree: WizardTree, input: WizardState, year: number) => {
  const steps = buildSteps(tree); if (input.accepted.length !== steps.length || input.accepted.some((value, i) => value !== `${steps[i].id}:${steps[i].phase}`)) throw new Error('Seluruh langkah tahunan dan bulanan belum dikonfirmasi.');
  const state = normalizeAutomatic(tree, input, steps.length);
  for (const step of steps) state.allocations[step.id] = validateStep(tree, state, step);
  for (const id of tree.order) {
    const allocation = state.allocations[id]; const children = tree.nodes[id].children;
    const annual = children.reduce((total, child) => addAmounts(total, state.allocations[child].team), allocation.personal);
    const monthly = children.reduce((total, child) => addMonths(total, state.allocations[child].teamMonths), allocation.personalMonths);
    if (!sameAmounts(annual, allocation.team) || !sameMonths(monthly, allocation.teamMonths)) throw new Error(`Cascading ${tree.nodes[id].user.name} tidak balance tahunan atau bulanan.`);
  }
  const draft: TargetDraft = {}; for (const id of tree.order) { const a = state.allocations[id]; draft[id] = { NB: a.personalMonths.NB, RN: a.personalMonths.RN, notes: a.notes }; }
  const baseline = state.allocations[tree.root].team;
  const result = calculateTargetSetup(tree.order.map(id => tree.nodes[id].user), draft, year, baseline);
  if (result.differences.NB !== 0 || result.differences.RN !== 0) throw new Error('Total Direktorat tidak balance.');
  for (const entry of result.entries) { const a = state.allocations[entry.userId]; if (entry.annualTargetNewBusiness !== Number(a.team.NB) || entry.annualTargetRenewal !== Number(a.team.RN)) throw new Error(`Target tahunan ${entry.userName} tidak sesuai pagu.`); }
  return { state, ...result };
};

/** Skip only mathematically determined steps. Every other amount needs explicit confirmation. */
export const continueWizard = (tree: WizardTree, input: WizardState): WizardState => {
  let state = structuredClone(input); const steps = buildSteps(tree);
  while (state.accepted.length < steps.length && steps[state.accepted.length].automatic) {
    state = acceptStep(tree, state, state.accepted.length);
  }
  return state;
};
