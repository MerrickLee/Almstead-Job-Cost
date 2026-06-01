// =============================================================================
// Almstead Product Costing — Shared Types
// =============================================================================

export type EquipmentRow = {
  id: string;
  truck_number: string;
  equipment_name: string;
  fuel_gph: number;          // gallons per hour
  annual_maint: number;      // USD per year
  annual_lic: number;        // USD per year (license + insurance + misc)
  days_used_per_year: number;// default 220
  active: boolean;
};

export type EmployeeRow = {
  id: string;
  branch_id: string;
  emp_no: string;
  classification: string;    // 'Foreman' | 'Climber' | 'Groundperson' | 'Spray Tech' | 'Lawn Tech' | etc.
  last_name: string;
  first_name: string;
  pay_per_hr: number;
  supplemental_per_hr: number;
  active: boolean;
};

export type Branch = {
  id: string;
  name: string;
  state: string;
  display_label: string;
  wc_rate: number;           // Workers' Comp rate (decimal)
  pr_rate: number;           // Payroll taxes rate (decimal)
  medical_per_hr: number;    // Medical cost per hour
  overhead_per_hr: number;   // Overhead burden per hour
  storm_bonus_per_8h: number;// Storm bonus per 8-hour shift (OT only)
  sort_order: number;
};

export type Classification = {
  id: string;
  label: string;
  emp_class: string;
  reg_wage: number;
  reg_supp: number;
  ot_wage: number;
  ot_supp: number;
  description: string;
  sort_order: number;
};

export type WhatIf = {
  profit_pct: number;          // 0.25 = 25%
  contrib_margin_pct: number;  // 1.0 = 100%
  fuel_per_gal: number;        // USD per gallon
  emergency_mult: number;      // 2.0 = 2×
};

export type LaborSelection = 'AVG' | string; // 'AVG' or employee_id (uuid)

export type WageSourceResult = {
  source: 'AVG' | 'EMPLOYEE' | 'NONE';
  label: string;
  payPerHr: number;
  supp: number;
  count: number;
  employeeId?: string;
};

export type LaborCostResult = {
  wagesBase: number;      // D: Hourly Employee Wages
  supp: number;           // E: Supplemental Offset
  certifiedTotal: number; // F: Certified total
  netCertified: number;   // G: Net certified
  wagesUsed: number;      // H: Higher of employee/certified
  wc: number;             // I: Workers' Comp
  payroll: number;        // J: P/R Taxes
  medical: number;        // K: Medical
  vacHol: number;         // L: Vacation/Holiday accrual
  overhead: number;       // M: Overhead burden
  storm: number;          // STORM: storm bonus (OT only)
  total: number;          // TOTAL: fully-loaded hourly cost
  source: 'AVG' | 'EMPLOYEE' | 'NONE';
  sourceLabel: string;
  employeeCount: number;
};

export type EquipmentCostResult = {
  fuelCost: number;
  maintHr: number;
  licHr: number;
  totalPerHr: number;
  totalPerDay: number;
};

export type CrewLine = {
  type: 'eq' | 'lb';
  empty?: boolean;
  label?: string;
  sourceLabel?: string;
  isPinned?: boolean;
  costPerHr?: number;
  emergPerHr?: number;
  profitPerHr?: number;
  totalPerHr?: number;
  employeeCount?: number;
};

export type CrewTotals = {
  costPerHr: number;
  costDay: number;
  profitPerHr: number;
  profitDay: number;
  billPerHr: number;
  billDay: number;
  emergPerHr: number;
  emergDay: number;
  ror: number | null;
};

export type CrewResult = {
  lines: CrewLine[];
  totals: CrewTotals;
};

export type CrewConfig = {
  branchId: string;
  equipment: Array<{ equipmentId: string | null }>;
  labor: Array<{ classification: string | null }>;
};

export type LaborSelections = Record<string, Record<string, LaborSelection>>;

export type FormulaContext = {
  whatIf: WhatIf;
  classifications: Classification[];
  branches: Branch[];
  employees: EmployeeRow[];
  equipment: EquipmentRow[];
  laborSelections: LaborSelections;
};
