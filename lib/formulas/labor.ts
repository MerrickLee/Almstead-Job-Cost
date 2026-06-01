// =============================================================================
// Labor Cost Calculation
// Verified against source workbook Labor sheet.
// DO NOT MODIFY the formula chain — it has real-money consequences.
// =============================================================================

import {
  EmployeeRow,
  Branch,
  Classification,
  WhatIf,
  LaborSelection,
  WageSourceResult,
  LaborCostResult,
} from './types';

/**
 * Classification → employee classification mapping.
 * Mirrors workbook exactly. Note "Groundman" (crew label) → "Groundperson" (employee classification).
 */
export const EMP_CLASS_MAP: Record<string, string> = {
  'Foreman':   'Foreman',
  'Climber':   'Climber',
  'Groundman': 'Groundperson',
  'Other-1':   'Spray Tech',
  'Other-2':   'Lawn Tech',
};

/** Arithmetic mean helper */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Resolve the wage source for a (branch, classification) slot.
 * Returns either the branch average or a specific pinned employee's rates.
 */
export function resolveWageSource(
  branchId: string,
  classificationLabel: string,
  selection: LaborSelection,
  employees: EmployeeRow[]
): WageSourceResult {
  const empClass = EMP_CLASS_MAP[classificationLabel] || classificationLabel;

  if (selection === 'AVG') {
    const matching = employees.filter(
      (e) => e.branch_id === branchId && e.classification === empClass && e.active
    );
    if (matching.length === 0) {
      return { source: 'NONE', label: `Average ${empClass} (no data)`, payPerHr: 0, supp: 0, count: 0 };
    }
    const payPerHr = mean(matching.map((e) => e.pay_per_hr));
    const supp = mean(matching.map((e) => e.supplemental_per_hr));
    return {
      source: 'AVG',
      label: `Average ${empClass}`,
      payPerHr,
      supp,
      count: matching.length,
    };
  }

  // Selection is an employee ID
  const emp = employees.find((e) => e.id === selection && e.active);
  if (!emp) {
    // Pinned employee deleted or deactivated — fall back to average
    return resolveWageSource(branchId, classificationLabel, 'AVG', employees);
  }

  return {
    source: 'EMPLOYEE',
    label: `${emp.last_name}, ${emp.first_name}`,
    payPerHr: emp.pay_per_hr,
    supp: emp.supplemental_per_hr,
    count: 1,
    employeeId: emp.id,
  };
}

/**
 * Compute the fully-loaded hourly labor cost for a (branch, classification)
 * at regular-time or overtime.
 *
 * This is the core formula chain. Letter-suffix variables match the Excel
 * column letters for auditability.
 *
 * Source workbook equivalents (Labor sheet, row 8 = New Rochelle Foreman):
 *
 * REGULAR TIME (columns D–N):
 *   D8  = VLOOKUP(B8, Employees!I:K, 2, FALSE)    // employee pay
 *   E8  = VLOOKUP(B8, Employees!I:K, 3, FALSE)    // employee supp
 *   F8  = 'What If Conditions'!F10                // certified total
 *   G8  = F8 - E8
 *   H8  = MAX(D8, G8)
 *   I8  = H8 * I$7        // WC at branch rate
 *   J8  = H8 * J$7        // P/R at branch rate
 *   K8  = K$7             // medical (branch)
 *   L8  = D8 * 0.1        // vac/hol
 *   M8  = M$7 * 'What If Conditions'!F6  // overhead * contrib margin
 *   N8  = SUM(H8:M8)
 *
 * OVERTIME (columns S–AD):
 *   S8  = D8 * 1.5
 *   T8  = E8
 *   U8  = 'What If Conditions'!K10
 *   V8  = U8 - T8
 *   W8  = MAX(S8, V8)
 *   X8  = H8 * X$7        // WC on straight-time wages (NY convention)
 *   Y8  = W8 * Y$7
 *   Z8  = Z$7
 *   AA8 = L8
 *   AB8 = AB$7 / 8        // storm bonus prorated
 *   AC8 = $M$8
 *   AD8 = SUM(W8:AC8)
 */
export function computeLaborCost(
  branchId: string,
  classificationLabel: string,
  selection: LaborSelection,
  mode: 'reg' | 'ot',
  ctx: {
    whatIf: WhatIf;
    classifications: Classification[];
    branches: Branch[];
    employees: EmployeeRow[];
  }
): LaborCostResult | null {
  const branch = ctx.branches.find((b) => b.id === branchId);
  const cls = ctx.classifications.find(
    (c) => c.label === classificationLabel
  );
  if (!branch || !cls) return null;

  const src = resolveWageSource(
    branchId,
    classificationLabel,
    selection,
    ctx.employees
  );

  // --- Formula chain (do not modify) ---
  const D = src.payPerHr;                                    // Hourly Employee Wages
  const E = src.supp;                                        // Supplemental Offset
  const F =
    mode === 'reg'
      ? cls.reg_wage + cls.reg_supp                          // Certified total (reg)
      : cls.ot_wage + cls.ot_supp;                           // Certified total (ot)
  const G = F - E;                                           // Net certified
  const H =
    mode === 'reg'
      ? Math.max(D, G)                                       // Higher of employee/certified
      : Math.max(D * 1.5, F - E);                            // OT: 1.5x employee or certified
  const I = H * branch.wc_rate;                              // Workers' Comp
  const J = H * branch.pr_rate;                              // P/R Taxes
  const K = branch.medical_per_hr;                           // Medical (branch flat)
  const L = D * 0.1;                                         // Vacation/Holiday accrual (10% of base wage)
  const M = branch.overhead_per_hr * ctx.whatIf.contrib_margin_pct; // Overhead burden
  const STORM =
    mode === 'ot'
      ? branch.storm_bonus_per_8h / 8                        // OT only, prorated to hr
      : 0;
  const TOTAL = H + I + J + K + L + M + STORM;

  return {
    wagesBase: D,
    supp: E,
    certifiedTotal: F,
    netCertified: G,
    wagesUsed: H,
    wc: I,
    payroll: J,
    medical: K,
    vacHol: L,
    overhead: M,
    storm: STORM,
    total: TOTAL,
    source: src.source,
    sourceLabel: src.label,
    employeeCount: src.count,
  };
}
