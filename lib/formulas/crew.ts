// =============================================================================
// Crew Cost Calculation
// Aggregates equipment + labor into crew totals.
// =============================================================================

import {
  EquipmentRow,
  CrewConfig,
  CrewLine,
  CrewResult,
  FormulaContext,
} from './types';
import { computeEquipmentCost } from './equipment';
import { computeLaborCost } from './labor';

/**
 * Compute the full crew cost breakdown.
 *
 * NOTE: The source workbook has a bug where the K-column total (emergency-rate
 * total) only spans labor rows 1–3, missing rows 4–5. This implementation
 * FIXES that bug — all 5 labor slots are summed correctly.
 *
 * @param crew - The crew configuration (branch, 3 equipment, 5 labor)
 * @param mode - 'reg' for regular time or 'ot' for overtime
 * @param ctx  - Formula context (whatIf, branches, employees, equipment, laborSelections)
 */
export function computeCrew(
  crew: CrewConfig,
  mode: 'reg' | 'ot',
  ctx: FormulaContext
): CrewResult {
  const profitRate = ctx.whatIf.profit_pct;
  const emergMult = ctx.whatIf.emergency_mult;
  const lines: CrewLine[] = [];

  // --- Equipment slots (exactly 3) ---
  for (const slot of crew.equipment) {
    if (!slot.equipmentId) {
      lines.push({ type: 'eq', empty: true });
      continue;
    }
    const eq = ctx.equipment.find((e) => e.id === slot.equipmentId);
    if (!eq) {
      lines.push({ type: 'eq', empty: true });
      continue;
    }
    const ec = computeEquipmentCost(eq, ctx.whatIf.fuel_per_gal);
    lines.push({
      type: 'eq',
      label: `#${eq.truck_number} ${eq.equipment_name}`,
      costPerHr: ec.totalPerHr,
      emergPerHr: ec.totalPerHr * emergMult,
      profitPerHr: ec.totalPerHr * profitRate,
      totalPerHr: ec.totalPerHr * (1 + profitRate),
    });
  }

  // --- Labor slots (exactly 5) ---
  for (const slot of crew.labor) {
    if (!slot.classification) {
      lines.push({ type: 'lb', empty: true });
      continue;
    }
    const selection =
      ctx.laborSelections[crew.branchId]?.[slot.classification] ?? 'AVG';
    const lc = computeLaborCost(
      crew.branchId,
      slot.classification,
      selection,
      mode,
      {
        whatIf: ctx.whatIf,
        classifications: ctx.classifications,
        branches: ctx.branches,
        employees: ctx.employees,
      }
    );
    if (!lc) {
      lines.push({ type: 'lb', empty: true });
      continue;
    }
    lines.push({
      type: 'lb',
      label: slot.classification,
      sourceLabel: lc.sourceLabel,
      isPinned: lc.source === 'EMPLOYEE',
      costPerHr: lc.total,
      emergPerHr: lc.total * emergMult,
      profitPerHr: lc.total * profitRate,
      totalPerHr: lc.total * (1 + profitRate),
      employeeCount: lc.employeeCount,
    });
  }

  // --- Totals ---
  const sumKey = (key: keyof CrewLine) =>
    lines.reduce(
      (s, l) => s + (l.empty ? 0 : ((l[key] as number) ?? 0)),
      0
    );

  const totalCost = sumKey('costPerHr');
  const totalProfit = sumKey('profitPerHr');
  const totalBill = sumKey('totalPerHr');
  const totalEmerg = sumKey('emergPerHr');

  // Rate of Return = (total billable for 8hr day) / (labor seats > $6/hr)
  // FIX: The source workbook only sums labor rows 1–3 for this calculation.
  // We correctly sum all 5 labor slots.
  const laborSeats = lines.filter(
    (l) => !l.empty && l.type === 'lb' && (l.totalPerHr ?? 0) >= 6
  ).length;
  const ror = laborSeats > 0 ? (totalBill * 8) / laborSeats : null;

  return {
    lines,
    totals: {
      costPerHr: totalCost,
      costDay: totalCost * 8,
      profitPerHr: totalProfit,
      profitDay: totalProfit * 8,
      billPerHr: totalBill,
      billDay: totalBill * 8,
      emergPerHr: totalEmerg,
      emergDay: totalEmerg * 8,
      ror,
    },
  };
}
