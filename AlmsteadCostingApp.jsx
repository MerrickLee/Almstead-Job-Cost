import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, Settings, Users, Wrench, HardHat, Calculator, Eye, Edit3, Plus, Trash2, Download, AlertCircle, Save, MapPin, TrendingUp, DollarSign, Clock } from 'lucide-react';

// ============================================================
// BRAND TOKENS (from Almstead brand guide)
// ============================================================
const C = {
  // Greens
  forest:    '#0F2419',  // deepest forest
  pine:      '#0E3A28',  // dark green primary
  emerald:   '#0E7C3A',  // logo green
  sage:      '#7FA589',
  fern:      '#B8D9A8',
  mist:      '#D9E8C9',
  lime:      '#7DBC3D',
  // Earth
  rust:      '#C6471F',
  ochre:     '#B88A2A',
  amber:     '#C99A48',
  clay:      '#B17E4F',
  rose:      '#A86D5F',
  // Neutrals
  ink:       '#0F2419',
  slate:     '#2E5359',
  paper:     '#FAFAF7',
  cream:     '#F4F2EA',
  butter:    '#FBF5E3',
  yellow:    '#F2DD2C',
  // UI
  border:    '#E5E3DA',
  borderDk:  '#C9C5B6',
  muted:     '#6B6A5F',
};

// ============================================================
// SEED DATA (extracted from the workbook)
// ============================================================
const SEED = {
  whatIf: {
    profitPct: 0.25,
    contribMargin: 1.0,
    fuelPerGal: 5.50,
    emergencyMult: 2.0,
    classifications: [
      { id: 'foreman',    label: 'Foreman',   regWage: 50.29, regSupp: 29.13, otWage: 75.435, otSupp: 29.13, desc: 'Westchester Heavy & Highway GR III' },
      { id: 'climber',    label: 'Climber',   regWage: 50.29, regSupp: 29.13, otWage: 75.435, otSupp: 29.13, desc: 'Westchester Heavy & Highway GR III' },
      { id: 'groundman',  label: 'Groundman', regWage: 49.56, regSupp: 29.13, otWage: 74.34,  otSupp: 29.13, desc: 'Westchester Heavy & Highway GR V' },
      { id: 'other1',     label: 'Other-1',   regWage: 0,     regSupp: 0,     otWage: 0,      otSupp: 0,     desc: 'PHC Spray Tech (non-certified)' },
      { id: 'other2',     label: 'Other-2',   regWage: 0,     regSupp: 0,     otWage: 0,      otSupp: 0,     desc: 'Lawn Tech (non-certified)' },
    ],
  },

  branches: [
    { id: 'newroch',   name: 'New Rochelle',  state: 'NY', label: 'NEW ROCHELLE NY BRANCH',
      wcRate: 0.0617, prRate: 0.1226, medical: 0,    overhead: 48.06, stormBonus: 0 },
    { id: 'hawthorne', name: 'Hawthorne',     state: 'NY', label: 'HAWTHORNE NY BRANCH',
      wcRate: 0.0617, prRate: 0.1544, medical: 0,    overhead: 43.80, stormBonus: 0 },
    { id: 'stamford',  name: 'Stamford',      state: 'CT', label: 'STAMFORD CONNECTICUT BRANCH',
      wcRate: 0.0526, prRate: 0.1712, medical: 0,    overhead: 41.13, stormBonus: 0 },
    { id: 'haledon',   name: 'North Haledon', state: 'NJ', label: 'NORTH HALEDON NJ BRANCH',
      wcRate: 0.1053, prRate: 0.2131, medical: 0,    overhead: 49.66, stormBonus: 0 },
  ],

  // Labor selection: branchId -> { classificationLabel -> selectionKey }
  // selectionKey is either "AVG" (use the branch average for the mapped employee classification)
  // or an employee identifier "empNo:firstName lastName"
  // Defaults to "AVG" for every classification at every branch (matches the spreadsheet defaults).
  laborSelection: {
    newroch:   { Foreman: 'AVG', Climber: 'AVG', Groundman: 'AVG', 'Other-1': 'AVG', 'Other-2': 'AVG' },
    hawthorne: { Foreman: 'AVG', Climber: 'AVG', Groundman: 'AVG', 'Other-1': 'AVG', 'Other-2': 'AVG' },
    stamford:  { Foreman: 'AVG', Climber: 'AVG', Groundman: 'AVG', 'Other-1': 'AVG', 'Other-2': 'AVG' },
    haledon:   { Foreman: 'AVG', Climber: 'AVG', Groundman: 'AVG', 'Other-1': 'AVG', 'Other-2': 'AVG' },
  },

  // Employees: branchId -> array of { empNo, classification, last, first, payPerHr, supp }
  employees: {
    hawthorne: [
      { empNo: '000073', classification: 'Foreman',      last: 'ALCANTAR',         first: 'CARLOS',         payPerHr: 43,   supp: 5.71 },
      { empNo: '000070', classification: 'Climber',      last: 'ALCANTAR',         first: 'JOSE',           payPerHr: 20,   supp: 2.89 },
      { empNo: '001356', classification: 'Lawn Tech',    last: 'ALCANTAR',         first: 'EFREN',          payPerHr: 22,   supp: 1.47 },
      { empNo: '001542', classification: 'Climber',      last: 'ALMADA ZORRILLA',  first: 'MARCOS',         payPerHr: 35,   supp: 2.33 },
      { empNo: '000077', classification: 'Foreman',      last: 'LICEA',            first: 'ANTONIO',        payPerHr: 29,   supp: 2.64 },
      { empNo: '001553', classification: 'Climber',      last: 'ARAGON MORENO',    first: 'VALENTIN',       payPerHr: 37,   supp: 2.47 },
      { empNo: '001297', classification: 'Spray Tech',   last: 'CASTILLO SOLIS',   first: 'JAVIER',         payPerHr: 31,   supp: 2.14 },
      { empNo: '000110', classification: 'Lawn Tech',    last: 'ANDREWS',          first: 'KEVIN',          payPerHr: 39,   supp: 5.27 },
      { empNo: '000098', classification: 'Climber',      last: 'VERA',             first: 'ROQUE',          payPerHr: 25,   supp: 2.39 },
      { empNo: '001573', classification: 'Spray Tech',   last: 'CASTILLO',         first: 'JAVIER (JAVIE)', payPerHr: 18,   supp: 1.20 },
      { empNo: '001268', classification: 'Groundperson', last: 'ESCOTO JR',        first: 'OSIRIS',         payPerHr: 17.5, supp: 3.72 },
      { empNo: '000102', classification: 'Groundperson', last: 'GOMEZ',            first: 'MARTIN',         payPerHr: 21,   supp: 1.94 },
      { empNo: '001520', classification: 'Climber',      last: 'LOPEZ CARMONA',    first: 'SILVESTRE',      payPerHr: 37,   supp: 2.29 },
      { empNo: '001375', classification: 'Climber',      last: 'MONGES',           first: 'LUIS',           payPerHr: 23,   supp: 1.76 },
    ],
    newroch: [
      { empNo: '001298', classification: 'Climber',            last: 'CUEVAS',          first: 'JOSE',           payPerHr: 29,   supp: 2.32 },
      { empNo: '000056', classification: 'Foreman',            last: 'FLORES',          first: 'ALEJANDRO',      payPerHr: 37,   supp: 4.83 },
      { empNo: '001362', classification: 'Climber',            last: 'ROSA',            first: 'ALEX',           payPerHr: 32,   supp: 3.04 },
      { empNo: '000100', classification: 'Climber',            last: 'TORRES',          first: 'JOSE',           payPerHr: 32,   supp: 1.81 },
      { empNo: '000051', classification: 'Operations Manager', last: 'SOLORIO BEJINES', first: 'ANTONIO',        payPerHr: 60.1, supp: 11.93 },
      { empNo: '001378', classification: 'Groundperson',       last: 'GALDAMEZ',        first: 'RICARDO JAVIER', payPerHr: 24,   supp: 1.60 },
      { empNo: '000059', classification: 'Groundperson',       last: 'OLIVEROS',        first: 'JOSE',           payPerHr: 17,   supp: 1.89 },
      { empNo: '000054', classification: 'Groundperson',       last: 'BARAJAS',         first: 'ANTONIO',        payPerHr: 28,   supp: 4.09 },
      { empNo: '001591', classification: 'Foreman',            last: 'MEZA CASTRO',     first: 'JESUS',          payPerHr: 36,   supp: 2.40 },
      { empNo: '001458', classification: 'Climber',            last: 'SUY',             first: 'ELMAR',          payPerHr: 32,   supp: 1.77 },
      { empNo: '000053', classification: 'Foreman',            last: 'BARAJAS',         first: 'RAUL',           payPerHr: 35,   supp: 4.73 },
      { empNo: '001338', classification: 'Climber',            last: 'TELLES',          first: 'GUSTAVO',        payPerHr: 31,   supp: 2.76 },
      { empNo: '001225', classification: 'Lawn Tech',          last: 'CUEVAS',          first: 'LUIS',           payPerHr: 25,   supp: 2.17 },
      { empNo: '000108', classification: 'Foreman',            last: 'ROSA',            first: 'HUGO',           payPerHr: 37,   supp: 3.19 },
      { empNo: '000064', classification: 'Climber',            last: 'GALVEZ',          first: 'JORGE',          payPerHr: 35,   supp: 3.89 },
      { empNo: '000177', classification: 'Groundperson',       last: 'VALDOVINOS',      first: 'RICARDO',        payPerHr: 29,   supp: 2.04 },
      { empNo: '000058', classification: 'Spray Tech',         last: 'MARTINEZ',        first: 'CESAR',          payPerHr: 28,   supp: 2.56 },
      { empNo: '001559', classification: 'Spray Tech',         last: 'DELGADO',         first: 'ESTEBAN',        payPerHr: 20,   supp: 1.33 },
      { empNo: '000097', classification: 'Groundperson',       last: 'ROSA',            first: 'MIGUEL',         payPerHr: 26,   supp: 2.35 },
      { empNo: '001592', classification: 'Groundperson',       last: 'LORENZO OGANDO',  first: 'FRANCISCO',      payPerHr: 25,   supp: 1.67 },
      { empNo: '001208', classification: 'Spray Tech',         last: 'NAJERA',          first: 'OSCAR',          payPerHr: 32,   supp: 5.37 },
      { empNo: '000061', classification: 'Spray Tech',         last: 'IBARRA',          first: 'LEOBARDO',       payPerHr: 37,   supp: 6.80 },
      { empNo: '000052', classification: 'Spray Tech',         last: 'MARTINEZ',        first: 'FEDERICO',       payPerHr: 35,   supp: 3.89 },
      { empNo: '000062', classification: 'Foreman',            last: 'SANCHEZ',         first: 'JOSE MARIA',     payPerHr: 37,   supp: 3.29 },
      { empNo: '001537', classification: 'Spray Tech',         last: 'VIDAL',           first: 'ENRIQUE',        payPerHr: 25,   supp: 1.67 },
      { empNo: '000115', classification: 'Climber',            last: 'RABANELES',       first: 'AURELIO',        payPerHr: 31,   supp: 3.40 },
      { empNo: '001321', classification: 'Groundperson',       last: 'VASQUEZ',         first: 'ERIC',           payPerHr: 25,   supp: 1.67 },
      { empNo: '001227', classification: 'Foreman',            last: 'ALVAREZ',         first: 'BELISARIO',      payPerHr: 40,   supp: 2.91 },
      { empNo: '001279', classification: 'Groundperson',       last: 'NUNEZ',           first: 'EDY',            payPerHr: 24,   supp: 1.68 },
      { empNo: '001291', classification: 'Groundperson',       last: 'ROSA ALMAZAN',    first: 'VICTOR',         payPerHr: 17,   supp: 1.41 },
      { empNo: '001294', classification: 'Foreman',            last: 'FLORES',          first: 'JAMIE',          payPerHr: 30,   supp: 4.21 },
    ],
    stamford: [
      { empNo: '001377', classification: 'Climber',      last: 'CAMEY',          first: 'HUMBERTO', payPerHr: 28, supp: 2.01 },
      { empNo: '000089', classification: 'Spray Tech',   last: 'CHRISTOFORO',    first: 'MARK',     payPerHr: 34, supp: 8.19 },
      { empNo: '001497', classification: 'Climber',      last: 'BONILLA',        first: 'ALBERTH',  payPerHr: 29, supp: 1.75 },
      { empNo: '001440', classification: 'Lawn Tech',    last: 'JAGNARINE',      first: 'RAMLALL',  payPerHr: 34, supp: 4.24 },
      { empNo: '000093', classification: 'Lawn Tech',    last: 'FINNEY',         first: 'MICHAEL',  payPerHr: 36, supp: 5.97 },
      { empNo: '000109', classification: 'Climber',      last: 'LOPEZ',          first: 'ENDER',    payPerHr: 36, supp: 4.54 },
      { empNo: '000057', classification: 'Foreman',      last: 'PEREZ',          first: 'MIGUEL',   payPerHr: 41, supp: 8.14 },
      { empNo: '001319', classification: 'Foreman',      last: 'LAINEZ',         first: 'HERNAN',   payPerHr: 35, supp: 5.23 },
      { empNo: '001241', classification: 'Foreman',      last: 'HUERTAS LOPEZ',  first: 'JORGE',    payPerHr: 37, supp: 2.66 },
      { empNo: '001415', classification: 'Foreman',      last: 'LARA',           first: 'VICTOR',   payPerHr: 37, supp: 3.29 },
      { empNo: '001390', classification: 'Climber',      last: 'LARA ZUNIGA',    first: 'JHONSON',  payPerHr: 28, supp: 2.20 },
      { empNo: '001543', classification: 'Groundperson', last: 'ORTEZ RAMIREZ',  first: 'LESTER',   payPerHr: 24, supp: 1.60 },
      { empNo: '001513', classification: 'Groundperson', last: 'OLIVARES',       first: 'LUIS',     payPerHr: 22, supp: 1.47 },
      { empNo: '001418', classification: 'Climber',      last: 'ORTEGA',         first: 'SERGIO',   payPerHr: 27, supp: 1.80 },
      { empNo: '001567', classification: 'Groundperson', last: 'PEREZ A',        first: 'MIGUEL',   payPerHr: 23, supp: 1.53 },
      { empNo: '001568', classification: 'Spray Tech',   last: 'SANTACRUZ',      first: 'OSCAR',    payPerHr: 32, supp: 2.13 },
      { empNo: '000074', classification: 'Climber',      last: 'SANTIAGO',       first: 'GERARDO',  payPerHr: 29, supp: 3.01 },
    ],
    haledon: [
      { empNo: '000065', classification: 'Foreman',      last: 'CORONA',        first: 'AMADOR',   payPerHr: 34.5, supp: 3.48 },
      { empNo: '001465', classification: 'Groundperson', last: 'ANGUIANO',      first: 'IVAN',     payPerHr: 24,   supp: 1.67 },
      { empNo: '001540', classification: 'Groundperson', last: 'CABALLERO',     first: 'JULIETA',  payPerHr: 21,   supp: 1.40 },
      { empNo: '001576', classification: 'Lawn Tech',    last: 'JEAN BAPTISTE', first: 'LOVENS',   payPerHr: 28,   supp: 1.87 },
      { empNo: '000101', classification: 'Spray Tech',   last: 'HURLEY',        first: 'JAMES',    payPerHr: 35,   supp: 3.11 },
      { empNo: '000071', classification: 'Foreman',      last: 'ANGUIANO',      first: 'SERGIO',   payPerHr: 40,   supp: 5.88 },
      { empNo: '001569', classification: 'Climber',      last: 'LLERA',         first: 'SIMON',    payPerHr: 30,   supp: 2.00 },
      { empNo: '000060', classification: 'Climber',      last: 'OLIVERA',       first: 'JOSE',     payPerHr: 32,   supp: 2.67 },
      { empNo: '000166', classification: 'Groundperson', last: 'ROSAS',         first: 'CARLOS',   payPerHr: 23,   supp: 1.79 },
    ],
  },

  // Equipment — abbreviated list of representative assets (more in workbook; user can add)
  equipment: [
    { truck: '40',  name: 'Tractor',         fuelGph: 4.5, annMaint: 21621.38, annLic: 1327.25, daysUsed: 220 },
    { truck: '48',  name: 'PHC Truck',       fuelGph: 2.3, annMaint: 7890.78,  annLic: 280.50,  daysUsed: 220 },
    { truck: '60',  name: 'Roll Off',        fuelGph: 3.5, annMaint: 18132.53, annLic: 414.50,  daysUsed: 220 },
    { truck: '62',  name: "60' Bucket",      fuelGph: 3.5, annMaint: 10509.28, annLic: 384.20,  daysUsed: 220 },
    { truck: '64',  name: "75' Bucket",      fuelGph: 4.0, annMaint: 17414.88, annLic: 511.00,  daysUsed: 220 },
    { truck: '65',  name: "75' Bucket",      fuelGph: 4.0, annMaint: 8814.05,  annLic: 599.10,  daysUsed: 220 },
    { truck: '68',  name: 'Grapple',         fuelGph: 3.5, annMaint: 12498.88, annLic: 599.10,  daysUsed: 220 },
    { truck: '83',  name: 'Chip Dump',       fuelGph: 2.8, annMaint: 10000.00, annLic: 409.50,  daysUsed: 220 },
    { truck: '84',  name: "56' Bucket",      fuelGph: 3.5, annMaint: 7300.62,  annLic: 325.25,  daysUsed: 220 },
    { truck: '91',  name: 'PHC Truck',       fuelGph: 2.3, annMaint: 9413.57,  annLic: 225.00,  daysUsed: 220 },
    { truck: '95',  name: 'Lawn Truck',      fuelGph: 1.8, annMaint: 5180.46,  annLic: 164.20,  daysUsed: 220 },
    { truck: '96',  name: "60' Bucket",      fuelGph: 3.5, annMaint: 12362.48, annLic: 273.25,  daysUsed: 220 },
    { truck: '97',  name: "75' Bucket",      fuelGph: 4.0, annMaint: 22679.98, annLic: 325.25,  daysUsed: 220 },
    { truck: '105', name: 'Mason Dump',      fuelGph: 2.5, annMaint: 9001.81,  annLic: 225.00,  daysUsed: 220 },
    { truck: '109', name: 'Hook Lift',       fuelGph: 3.0, annMaint: 9000.00,  annLic: 0,       daysUsed: 220 },
    { truck: '160', name: "70' Bucket w/Elevator", fuelGph: 4.0, annMaint: 12000, annLic: 1100, daysUsed: 220 },
    { truck: '206', name: '18" Chipper',     fuelGph: 3.0, annMaint: 7585.84,  annLic: 0,       daysUsed: 220 },
    { truck: '239', name: 'Wheel Loader',    fuelGph: 3.5, annMaint: 28598.74, annLic: 0,       daysUsed: 220 },
    { truck: '255', name: 'Rotochopper 255B 2015', fuelGph: 7.0, annMaint: 32766.55, annLic: 0, daysUsed: 220 },
    { truck: '300', name: 'Skid Steer',      fuelGph: 2.3, annMaint: 5000.00,  annLic: 0,       daysUsed: 220 },
    { truck: '308', name: 'Grinder',         fuelGph: 7.0, annMaint: 12000.00, annLic: 0,       daysUsed: 220 },
    { truck: '400', name: 'Lawn Applicator', fuelGph: 0.6, annMaint: 1500.00,  annLic: 0,       daysUsed: 220 },
    { truck: '402', name: 'Lawn Machine',    fuelGph: 1.5, annMaint: 2000.00,  annLic: 0,       daysUsed: 220 },
    { truck: '403', name: 'Lawn Aerator',    fuelGph: 0.4, annMaint: 750.00,   annLic: 0,       daysUsed: 220 },
  ],
};

// ============================================================
// FORMULA ENGINE
// ============================================================

const fmt$ = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n === 0) return '$0';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmt$0 = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtPct = (n) => (n * 100).toFixed(2) + '%';

// Average employee for a branch & classification (returns null if none)
function avgEmployee(employees, branchId, classification) {
  const list = (employees[branchId] || []).filter(e => e.classification === classification);
  if (list.length === 0) return null;
  const payPerHr = list.reduce((s, e) => s + Number(e.payPerHr || 0), 0) / list.length;
  const supp     = list.reduce((s, e) => s + Number(e.supp     || 0), 0) / list.length;
  return { payPerHr, supp, count: list.length };
}

// Map crew classification label -> employee classification label.
// Foreman/Climber/Groundman align with Foreman/Climber/Groundperson rosters.
// Other-1 maps to Spray Tech, Other-2 maps to Lawn Tech (as in the original sheet).
const EMP_CLASS_MAP = {
  'Foreman':   'Foreman',
  'Climber':   'Climber',
  'Groundman': 'Groundperson',
  'Other-1':   'Spray Tech',
  'Other-2':   'Lawn Tech',
};

// Unique key for an employee row
function empKey(emp) {
  return `${emp.empNo}::${emp.first} ${emp.last}`;
}

// Resolve the wage source for a (branch, classification) based on the laborSelection.
// Returns { source: 'AVG'|'EMPLOYEE'|'NONE', label, payPerHr, supp, employeeCount }
function resolveWageSource(state, branchId, classificationLabel) {
  const empClass = EMP_CLASS_MAP[classificationLabel] || classificationLabel;
  const selection = state.laborSelection?.[branchId]?.[classificationLabel] || 'AVG';

  if (selection === 'AVG') {
    const avg = avgEmployee(state.employees, branchId, empClass);
    return avg
      ? { source: 'AVG', label: `Average ${empClass}`, payPerHr: avg.payPerHr, supp: avg.supp, employeeCount: avg.count }
      : { source: 'NONE', label: `Average ${empClass} (no data)`, payPerHr: 0, supp: 0, employeeCount: 0 };
  }

  // Find the specific employee
  const roster = state.employees[branchId] || [];
  const emp = roster.find(e => empKey(e) === selection);
  if (!emp) {
    // Selection points to a deleted employee — fall back to average
    const avg = avgEmployee(state.employees, branchId, empClass);
    return avg
      ? { source: 'AVG', label: `Average ${empClass}`, payPerHr: avg.payPerHr, supp: avg.supp, employeeCount: avg.count }
      : { source: 'NONE', label: `Average ${empClass} (no data)`, payPerHr: 0, supp: 0, employeeCount: 0 };
  }
  return {
    source: 'EMPLOYEE',
    label: `${emp.first} ${emp.last}`,
    payPerHr: Number(emp.payPerHr || 0),
    supp: Number(emp.supp || 0),
    employeeCount: 1,
    empNo: emp.empNo,
    empClass: emp.classification,
  };
}

// Compute fully-loaded hourly labor cost for a (branch, classification) at reg/ot
// Mirrors the Labor sheet formula chain. Honors per-branch employee selection.
function computeLaborCost(state, branchId, classificationLabel, mode /* 'reg' | 'ot' */) {
  const branch = state.branches.find(b => b.id === branchId);
  if (!branch) return null;

  // Find certified wage from What If
  const cls = state.whatIf.classifications.find(c => c.label === classificationLabel);
  if (!cls) return null;

  const src = resolveWageSource(state, branchId, classificationLabel);

  const D = src.payPerHr;                              // Hourly Employee Wages
  const E = src.supp;                                  // Supplemental Offset
  const F = mode === 'reg' ? (cls.regWage + cls.regSupp) : (cls.otWage + cls.otSupp); // Certified total
  const G = F - E;                                     // Net certified
  const H = mode === 'reg' ? Math.max(D, G) : Math.max(D * 1.5, F - E); // Wage used
  const I = H * branch.wcRate;                         // WC
  const J = H * branch.prRate;                         // P/R
  const K = branch.medical;                            // Medical
  const L = D * 0.1;                                   // Vac/Hol = base wage * 10%
  const M = branch.overhead * state.whatIf.contribMargin; // Overhead burden
  const STORM = mode === 'ot' ? (branch.stormBonus / 8) : 0;
  const TOTAL = H + I + J + K + L + M + STORM;

  return {
    wagesBase: D, supp: E, certifiedTotal: F, netCertified: G, wagesUsed: H,
    wc: I, payroll: J, medical: K, vacHol: L, overhead: M, storm: STORM,
    total: TOTAL,
    source: src.source, sourceLabel: src.label,
    employeeCount: src.employeeCount,
  };
}

// Equipment hourly cost
function computeEquipCost(eq, fuelPerGal) {
  const fuelCost = eq.fuelGph * fuelPerGal;
  const maintHr  = eq.daysUsed > 0 ? eq.annMaint / (eq.daysUsed * 8) : 0;
  const licHr    = eq.daysUsed > 0 ? eq.annLic   / (eq.daysUsed * 8) : 0;
  const total = fuelCost + maintHr + licHr;
  return { fuelCost, maintHr, licHr, total, totalDay: total * 8 };
}

// Crew totals for a branch
function computeCrew(state, crew, mode /* reg | ot */) {
  const profitRate = state.whatIf.profitPct;
  const emergMult  = state.whatIf.emergencyMult;
  const lines = [];

  // Equipment lines (up to 3)
  for (const e of (crew.equipment || [])) {
    if (!e.truck) { lines.push(null); continue; }
    const eq = state.equipment.find(x => x.truck === e.truck);
    if (!eq) { lines.push(null); continue; }
    const ec = computeEquipCost(eq, state.whatIf.fuelPerGal);
    const cost = ec.total;
    lines.push({
      type: 'eq',
      label: `#${eq.truck} ${eq.name}`,
      costPerHr: cost,
      emergencyPerHr: cost * emergMult,
      profitPerHr: cost * profitRate,
      totalPerHr: cost + cost * profitRate,
    });
  }
  // Labor lines (up to 5)
  for (const l of (crew.labor || [])) {
    if (!l.classification) { lines.push(null); continue; }
    const lc = computeLaborCost(state, crew.branchId, l.classification, mode);
    if (!lc) { lines.push(null); continue; }
    const cost = lc.total;
    lines.push({
      type: 'labor',
      label: l.classification,
      sourceLabel: lc.sourceLabel,
      isPinned: lc.source === 'EMPLOYEE',
      costPerHr: cost,
      emergencyPerHr: cost * emergMult,
      profitPerHr: cost * profitRate,
      totalPerHr: cost + cost * profitRate,
      employeeCount: lc.employeeCount,
    });
  }

  const sum = (key) => lines.reduce((s, l) => s + (l ? l[key] : 0), 0);
  const totalCost   = sum('costPerHr');
  const totalEmerg  = sum('emergencyPerHr');
  const totalProfit = sum('profitPerHr');
  const totalBill   = sum('totalPerHr');
  const laborSeats  = lines.filter(l => l && l.type === 'labor' && l.totalPerHr >= 6).length;
  const ror = laborSeats > 0 ? (totalBill * 8) / laborSeats : null;

  return {
    lines,
    totals: {
      costPerHr: totalCost, costDay: totalCost * 8,
      emergPerHr: totalEmerg, emergDay: totalEmerg * 8,
      profitPerHr: totalProfit, profitDay: totalProfit * 8,
      billPerHr: totalBill, billDay: totalBill * 8,
      ror,
    },
  };
}

// ============================================================
// MAIN APP
// ============================================================

export default function AlmsteadCostingApp() {
  const [state, setState]   = useState(SEED);
  const [activeTab, setTab] = useState('crews');
  const [mode, setMode]     = useState('view'); // 'view' | 'edit'
  const [otMode, setOtMode] = useState(false);  // toggle reg time vs overtime
  const [activeBranch, setActiveBranch] = useState('newroch');

  // One crew per branch, persisted in app state
  const [crews, setCrews] = useState(() => {
    const out = {};
    for (const b of SEED.branches) {
      out[b.id] = {
        branchId: b.id,
        equipment: [{ truck: '' }, { truck: '' }, { truck: '' }],
        labor: [{ classification: '' }, { classification: '' }, { classification: '' }, { classification: '' }, { classification: '' }],
      };
    }
    return out;
  });

  // Edit-mode is admin only — auto-revert if user toggles to non-admin views
  const isAdmin = mode === 'edit';

  // Brand-aware shell
  return (
    <div style={{
      minHeight: '100vh',
      background: C.paper,
      fontFamily: '"Spline Sans", -apple-system, BlinkMacSystemFont, sans-serif',
      color: C.ink,
    }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spline+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" />

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .mono { font-family: 'DM Mono', 'SF Mono', Menlo, monospace; }
        .tab-btn:hover { background: ${C.cream}; }
        .tab-btn.active { background: ${C.pine}; color: ${C.paper}; }
        .input-field {
          background: ${C.butter};
          border: 1px solid ${C.borderDk};
          padding: 6px 10px;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          color: ${C.ink};
          border-radius: 3px;
          width: 100%;
          transition: all 0.15s;
        }
        .input-field:focus {
          outline: none;
          border-color: ${C.emerald};
          background: ${C.paper};
          box-shadow: 0 0 0 3px ${C.fern}80;
        }
        .input-field:disabled, .input-field[readonly] {
          background: transparent;
          border-color: transparent;
          color: ${C.ink};
        }
        .select-field {
          background: ${C.butter};
          border: 1px solid ${C.borderDk};
          padding: 6px 10px;
          font-family: 'Spline Sans', sans-serif;
          font-size: 13px;
          color: ${C.ink};
          border-radius: 3px;
          width: 100%;
          cursor: pointer;
        }
        .select-field:focus {
          outline: none;
          border-color: ${C.emerald};
          box-shadow: 0 0 0 3px ${C.fern}80;
        }
        .btn-primary {
          background: ${C.pine};
          color: ${C.paper};
          padding: 10px 20px;
          border: none;
          border-radius: 999px;
          font-family: 'Spline Sans', sans-serif;
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-primary:hover { background: ${C.emerald}; transform: translateY(-1px); }
        .btn-accent {
          background: ${C.ochre};
          color: ${C.paper};
          padding: 10px 20px;
          border: none;
          border-radius: 999px;
          font-family: 'Spline Sans', sans-serif;
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-accent:hover { background: ${C.amber}; }
        .btn-ghost {
          background: transparent;
          color: ${C.ink};
          padding: 8px 14px;
          border: 1px solid ${C.borderDk};
          border-radius: 999px;
          font-family: 'Spline Sans', sans-serif;
          font-weight: 500;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn-ghost:hover { border-color: ${C.pine}; background: ${C.cream}; }
        .btn-danger {
          background: transparent;
          color: ${C.rust};
          padding: 4px 6px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-danger:hover { background: ${C.rust}15; }
        .card {
          background: ${C.paper};
          border: 1px solid ${C.border};
          border-radius: 8px;
        }
        .header-row {
          background: ${C.forest};
          color: ${C.paper};
        }
        .branch-pill {
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          border: 1.5px solid ${C.borderDk};
          background: transparent;
          color: ${C.ink};
          font-family: 'Spline Sans', sans-serif;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .branch-pill:hover { border-color: ${C.pine}; }
        .branch-pill.active {
          background: ${C.pine};
          color: ${C.paper};
          border-color: ${C.pine};
        }
        table { border-collapse: collapse; width: 100%; }
        th { text-align: left; font-weight: 500; font-size: 11px; text-transform: uppercase;
             letter-spacing: 0.05em; color: ${C.muted}; padding: 10px 12px;
             border-bottom: 1px solid ${C.border}; background: ${C.cream}; }
        td { padding: 8px 12px; font-size: 13px; vertical-align: middle;
             border-bottom: 1px solid ${C.border}; }
        tr:hover td { background: ${C.cream}40; }
        tr.total-row td { background: ${C.pine}; color: ${C.paper};
                          font-weight: 600; border-bottom: none; }
        tr.total-row td:first-child { border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
        tr.total-row td:last-child { border-top-right-radius: 6px; border-bottom-right-radius: 6px; }
        .num { font-family: 'DM Mono', monospace; font-variant-numeric: tabular-nums; text-align: right; }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
      `}</style>

      {/* HEADER BAR */}
      <header style={{
        background: C.forest,
        color: C.paper,
        padding: '18px 32px',
        borderBottom: `1px solid ${C.pine}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Almstead logo treatment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 6,
                background: C.emerald,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <span style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 32, fontWeight: 700,
                  color: C.paper, lineHeight: 1,
                }}>a</span>
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: C.fern,
                  border: `2px solid ${C.forest}`,
                }} />
              </div>
              <div>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 22, fontWeight: 700,
                  letterSpacing: '0.02em', color: C.paper,
                }}>ALMSTEAD</div>
                <div style={{
                  fontSize: 9, fontWeight: 500,
                  letterSpacing: '0.18em', color: C.fern,
                  marginTop: -2,
                }}>TREE, SHRUB & LAWN CARE</div>
              </div>
            </div>
            <div style={{
              borderLeft: `1px solid ${C.pine}`,
              paddingLeft: 16, marginLeft: 8,
            }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Product Costing</div>
              <div style={{ fontSize: 11, color: C.fern, letterSpacing: '0.05em' }}>
                Worksheets 2026 · Data as of 5/14/2026
              </div>
            </div>
          </div>

          {/* View/Edit toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'inline-flex',
              background: C.pine,
              borderRadius: 999,
              padding: 4,
              gap: 0,
            }}>
              <button
                onClick={() => setMode('view')}
                style={{
                  padding: '8px 18px', borderRadius: 999, border: 'none',
                  background: mode === 'view' ? C.paper : 'transparent',
                  color:      mode === 'view' ? C.pine  : C.paper,
                  fontFamily: 'Spline Sans', fontSize: 12, fontWeight: 600,
                  letterSpacing: '0.05em', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Eye size={14} /> SALES VIEW
              </button>
              <button
                onClick={() => setMode('edit')}
                style={{
                  padding: '8px 18px', borderRadius: 999, border: 'none',
                  background: mode === 'edit' ? C.yellow : 'transparent',
                  color:      mode === 'edit' ? C.forest : C.paper,
                  fontFamily: 'Spline Sans', fontSize: 12, fontWeight: 600,
                  letterSpacing: '0.05em', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Edit3 size={14} /> ADMIN
              </button>
            </div>
          </div>
        </div>

        {/* TABS */}
        <nav style={{ display: 'flex', gap: 4, marginTop: 18, marginBottom: -19 }}>
          {[
            { id: 'crews',     label: 'Crew Bid Sheet', icon: Calculator },
            { id: 'whatif',    label: 'What If Conditions', icon: Settings, adminOnly: true },
            { id: 'labor',     label: 'Labor', icon: HardHat, adminOnly: false },
            { id: 'equipment', label: 'Equipment', icon: Wrench, adminOnly: false },
            { id: 'employees', label: 'Employees', icon: Users, adminOnly: false },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '12px 20px',
                  background: isActive ? C.paper : 'transparent',
                  color: isActive ? C.pine : C.fern,
                  border: 'none',
                  borderTopLeftRadius: 8, borderTopRightRadius: 8,
                  fontFamily: 'Spline Sans',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: isActive ? `3px solid ${C.yellow}` : '3px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={15} />
                {t.label}
                {t.adminOnly && mode !== 'edit' && (
                  <span style={{ fontSize: 9, opacity: 0.6 }}>(ADMIN)</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* CONTENT */}
      <main style={{ padding: '32px', maxWidth: 1480, margin: '0 auto' }}>
        {activeTab === 'crews' && (
          <CrewsTab
            state={state} setState={setState}
            crews={crews} setCrews={setCrews}
            activeBranch={activeBranch} setActiveBranch={setActiveBranch}
            otMode={otMode} setOtMode={setOtMode}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === 'whatif' && (
          <WhatIfTab state={state} setState={setState} isAdmin={isAdmin} />
        )}
        {activeTab === 'labor' && (
          <LaborTab
            state={state} setState={setState} isAdmin={isAdmin}
            activeBranch={activeBranch} setActiveBranch={setActiveBranch}
          />
        )}
        {activeTab === 'equipment' && (
          <EquipmentTab state={state} setState={setState} isAdmin={isAdmin} />
        )}
        {activeTab === 'employees' && (
          <EmployeesTab
            state={state} setState={setState} isAdmin={isAdmin}
            activeBranch={activeBranch} setActiveBranch={setActiveBranch}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer style={{
        marginTop: 60, padding: '20px 32px',
        background: C.forest, color: C.fern,
        fontSize: 11, letterSpacing: '0.05em',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>ALMSTEAD TREE, SHRUB & LAWN CARE · FOUNDED 1964</span>
        <span>Replicates "Product_Costing_worksheets_2026_FINAL_BUILD_5-26-2026_003.xlsx"</span>
      </footer>
    </div>
  );
}

// ============================================================
// CREWS TAB — the bid sheet
// ============================================================
function CrewsTab({ state, crews, setCrews, activeBranch, setActiveBranch, otMode, setOtMode, isAdmin }) {
  const crew = crews[activeBranch];
  const branch = state.branches.find(b => b.id === activeBranch);

  const result = useMemo(
    () => computeCrew(state, crew, otMode ? 'ot' : 'reg'),
    [state, crew, otMode]
  );

  const updateEquip = (idx, truck) => {
    setCrews(prev => ({
      ...prev,
      [activeBranch]: {
        ...prev[activeBranch],
        equipment: prev[activeBranch].equipment.map((e, i) => i === idx ? { truck } : e),
      },
    }));
  };
  const updateLabor = (idx, classification) => {
    setCrews(prev => ({
      ...prev,
      [activeBranch]: {
        ...prev[activeBranch],
        labor: prev[activeBranch].labor.map((l, i) => i === idx ? { classification } : l),
      },
    }));
  };
  const resetCrew = () => {
    setCrews(prev => ({
      ...prev,
      [activeBranch]: {
        branchId: activeBranch,
        equipment: [{ truck: '' }, { truck: '' }, { truck: '' }],
        labor: [{ classification: '' }, { classification: '' }, { classification: '' }, { classification: '' }, { classification: '' }],
      },
    }));
  };

  return (
    <div>
      {/* PAGE INTRO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontFamily: 'Spline Sans', fontSize: 36, fontWeight: 700,
            margin: 0, color: C.ink, letterSpacing: '-0.02em',
          }}>Build a Crew. Get a Bid.</h1>
          <p style={{ color: C.muted, fontSize: 15, marginTop: 6, maxWidth: 580 }}>
            Pick equipment and labor classifications. Costs, profit, and the billable rate update live.
            Toggle between regular time and overtime to compare pricing scenarios.
          </p>
        </div>
        <button className="btn-ghost" onClick={resetCrew}>
          <Trash2 size={13} /> Reset crew
        </button>
      </div>

      {/* BRANCH PILLS + OT TOGGLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state.branches.map(b => (
            <button
              key={b.id}
              className={`branch-pill ${activeBranch === b.id ? 'active' : ''}`}
              onClick={() => setActiveBranch(b.id)}
            >
              <MapPin size={12} /> {b.name} · {b.state}
            </button>
          ))}
        </div>
        <div style={{
          display: 'inline-flex', background: C.cream,
          borderRadius: 999, padding: 4,
          border: `1px solid ${C.border}`,
        }}>
          <button
            onClick={() => setOtMode(false)}
            style={{
              padding: '6px 16px', borderRadius: 999, border: 'none',
              background: !otMode ? C.emerald : 'transparent',
              color: !otMode ? C.paper : C.ink,
              fontFamily: 'Spline Sans', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          ><Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />REGULAR TIME</button>
          <button
            onClick={() => setOtMode(true)}
            style={{
              padding: '6px 16px', borderRadius: 999, border: 'none',
              background: otMode ? C.rust : 'transparent',
              color: otMode ? C.paper : C.ink,
              fontFamily: 'Spline Sans', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          ><TrendingUp size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />OVERTIME (1.5×)</button>
        </div>
      </div>

      {/* HEADLINE METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Metric label="Hourly Cost" value={fmt$(result.totals.costPerHr)} sub={fmt$0(result.totals.costDay) + ' / 8-hr day'} color={C.slate} />
        <Metric label="Profit @ 25%" value={fmt$(result.totals.profitPerHr)} sub={fmt$0(result.totals.profitDay) + ' / 8-hr day'} color={C.ochre} />
        <Metric label="Billable Hourly" value={fmt$(result.totals.billPerHr)} sub={fmt$0(result.totals.billDay) + ' / 8-hr day'} color={C.emerald} highlight />
        <Metric label="Emergency Rate" value={fmt$(result.totals.emergPerHr)} sub={`@ ${state.whatIf.emergencyMult}× cost mult.`} color={C.rust} />
      </div>

      {/* MAIN BID TABLE */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          background: C.pine, color: C.paper,
          padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.fern, letterSpacing: '0.08em', fontWeight: 500 }}>
              {branch.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              Crew Configuration · {otMode ? 'Overtime' : 'Regular Time'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.fern, fontFamily: 'DM Mono' }}>
            Profit {fmtPct(state.whatIf.profitPct)} · Fuel ${state.whatIf.fuelPerGal.toFixed(2)}/gal
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Description</th>
              <th className="num">Cost / Hr</th>
              <th className="num">Emergency / Hr</th>
              <th className="num">Profit / Hr</th>
              <th className="num">Total / Hr</th>
              <th className="num">Total / Day</th>
            </tr>
          </thead>
          <tbody>
            {/* EQUIPMENT ROWS */}
            {crew.equipment.map((e, i) => {
              const line = result.lines[i];
              return (
                <tr key={'eq' + i}>
                  <td style={{ color: C.muted, fontWeight: 500 }}>
                    <span className="badge" style={{ background: C.fern, color: C.pine }}>EQ {i + 1}</span>
                  </td>
                  <td>
                    <select
                      className="select-field"
                      value={e.truck}
                      onChange={(ev) => updateEquip(i, ev.target.value)}
                    >
                      <option value="">— Select equipment —</option>
                      {state.equipment.map(eq => (
                        <option key={eq.truck} value={eq.truck}>
                          #{eq.truck} {eq.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">{line ? fmt$(line.costPerHr) : '—'}</td>
                  <td className="num">{line ? fmt$(line.emergencyPerHr) : '—'}</td>
                  <td className="num">{line ? fmt$(line.profitPerHr) : '—'}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{line ? fmt$(line.totalPerHr) : '—'}</td>
                  <td className="num">{line ? fmt$0(line.totalPerHr * 8) : '—'}</td>
                </tr>
              );
            })}

            {/* DIVIDER */}
            <tr><td colSpan={7} style={{ padding: 0, height: 1, background: C.borderDk, border: 'none' }}></td></tr>

            {/* LABOR ROWS */}
            {crew.labor.map((l, i) => {
              const line = result.lines[i + 3];
              return (
                <tr key={'lb' + i}>
                  <td style={{ color: C.muted, fontWeight: 500 }}>
                    <span className="badge" style={{ background: C.butter, color: C.ochre }}>LB {i + 1}</span>
                  </td>
                  <td>
                    <select
                      className="select-field"
                      value={l.classification}
                      onChange={(ev) => updateLabor(i, ev.target.value)}
                    >
                      <option value="">— Select classification —</option>
                      {state.whatIf.classifications.map(c => (
                        <option key={c.id} value={c.label}>{c.label}</option>
                      ))}
                    </select>
                    {line && line.sourceLabel && (
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {line.isPinned ? (
                          <span style={{ color: C.ochre, fontWeight: 600 }}>👤 {line.sourceLabel}</span>
                        ) : (
                          <span>📊 {line.sourceLabel}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="num">{line ? fmt$(line.costPerHr) : '—'}</td>
                  <td className="num">{line ? fmt$(line.emergencyPerHr) : '—'}</td>
                  <td className="num">{line ? fmt$(line.profitPerHr) : '—'}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{line ? fmt$(line.totalPerHr) : '—'}</td>
                  <td className="num">{line ? fmt$0(line.totalPerHr * 8) : '—'}</td>
                </tr>
              );
            })}

            {/* TOTAL ROW */}
            <tr className="total-row">
              <td colSpan={2} style={{ fontSize: 13, letterSpacing: '0.05em' }}>CREW TOTAL</td>
              <td className="num">{fmt$(result.totals.costPerHr)}</td>
              <td className="num">{fmt$(result.totals.emergPerHr)}</td>
              <td className="num">{fmt$(result.totals.profitPerHr)}</td>
              <td className="num" style={{ fontSize: 15 }}>{fmt$(result.totals.billPerHr)}</td>
              <td className="num" style={{ fontSize: 15 }}>{fmt$0(result.totals.billDay)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECONDARY DIAGNOSTICS */}
      {result.totals.ror && (
        <div style={{
          marginTop: 16, padding: '14px 20px',
          background: C.cream, borderRadius: 8,
          border: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', fontWeight: 500 }}>
              RATE OF RETURN (PER LABOR SEAT, 8-HR DAY)
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.pine, fontFamily: 'DM Mono' }}>
              {fmt$(result.totals.ror)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, maxWidth: 380, textAlign: 'right' }}>
            Total 8-hr billable divided by count of labor seats priced above $6/hr.
            A productivity sanity check.
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, color, highlight }) {
  return (
    <div style={{
      padding: '18px 20px',
      background: highlight ? color : C.paper,
      color: highlight ? C.paper : C.ink,
      borderRadius: 8,
      border: highlight ? 'none' : `1px solid ${C.border}`,
      position: 'relative',
    }}>
      {highlight && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: C.yellow, color: C.forest,
          fontSize: 9, padding: '2px 8px', borderRadius: 999,
          fontWeight: 700, letterSpacing: '0.08em',
        }}>QUOTE THIS</div>
      )}
      <div style={{
        fontSize: 10, letterSpacing: '0.1em', fontWeight: 600,
        color: highlight ? C.fern : C.muted, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontSize: 28, fontWeight: 700,
        marginTop: 6, fontFamily: 'DM Mono',
        color: highlight ? C.paper : color, letterSpacing: '-0.02em',
      }}>{value}</div>
      <div style={{
        fontSize: 11, color: highlight ? C.fern : C.muted,
        marginTop: 4,
      }}>{sub}</div>
    </div>
  );
}

// ============================================================
// WHAT IF TAB
// ============================================================
function WhatIfTab({ state, setState, isAdmin }) {
  if (!isAdmin) {
    return <AdminOnlyMessage tabName="What If Conditions" />;
  }

  const update = (path, value) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let target = next;
      for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
      target[keys[keys.length - 1]] = value;
      return next;
    });
  };
  const updateCls = (idx, field, value) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.whatIf.classifications[idx][field] = value;
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="What If Conditions"
        subtitle="Global assumptions. Changes here ripple through every branch's labor build-up and crew bid."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <SectionTitle>Pricing assumptions</SectionTitle>
          <FieldGrid>
            <NumField label="Profit Percentage" value={state.whatIf.profitPct} onChange={v => update('whatIf.profitPct', v)} suffix="(decimal)" />
            <NumField label="Contribution Margin %" value={state.whatIf.contribMargin} onChange={v => update('whatIf.contribMargin', v)} suffix="(decimal)" />
            <NumField label="Fuel Cost / Gallon" value={state.whatIf.fuelPerGal} onChange={v => update('whatIf.fuelPerGal', v)} prefix="$" />
            <NumField label="Emergency Multiplier" value={state.whatIf.emergencyMult} onChange={v => update('whatIf.emergencyMult', v)} suffix="×" />
          </FieldGrid>
        </div>

        <div className="card" style={{ padding: 24, background: C.butter }}>
          <SectionTitle>How these flow downstream</SectionTitle>
          <ul style={{ fontSize: 13, color: C.ink, paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
            <li><strong>Profit %</strong> — multiplied by each line's cost to compute profit dollars and billable rate.</li>
            <li><strong>Contribution Margin %</strong> — multiplier on each branch's overhead burden on the Labor tab.</li>
            <li><strong>Fuel / gallon</strong> — drives every piece of equipment's hourly fuel cost.</li>
            <li><strong>Emergency multiplier</strong> — applied to costs on the crew sheet for storm/after-hours quoting.</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 20px', background: C.cream, borderBottom: `1px solid ${C.border}` }}>
          <SectionTitle style={{ margin: 0 }}>Labor classifications & certified wages</SectionTitle>
        </div>
        <table>
          <thead>
            <tr>
              <th>Classification</th>
              <th className="num">Reg Wage</th>
              <th className="num">Reg Supp.</th>
              <th className="num">OT Wage</th>
              <th className="num">OT Supp.</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {state.whatIf.classifications.map((c, i) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.label}</td>
                <td><input className="input-field num" type="number" step="0.01" value={c.regWage} onChange={e => updateCls(i, 'regWage', parseFloat(e.target.value) || 0)} /></td>
                <td><input className="input-field num" type="number" step="0.01" value={c.regSupp} onChange={e => updateCls(i, 'regSupp', parseFloat(e.target.value) || 0)} /></td>
                <td><input className="input-field num" type="number" step="0.01" value={c.otWage}  onChange={e => updateCls(i, 'otWage',  parseFloat(e.target.value) || 0)} /></td>
                <td><input className="input-field num" type="number" step="0.01" value={c.otSupp}  onChange={e => updateCls(i, 'otSupp',  parseFloat(e.target.value) || 0)} /></td>
                <td><input className="input-field" type="text" value={c.desc} onChange={e => updateCls(i, 'desc', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// LABOR TAB
// ============================================================
function LaborTab({ state, setState, isAdmin, activeBranch, setActiveBranch }) {
  const branch = state.branches.find(b => b.id === activeBranch);

  const updateBranch = (field, value) => {
    setState(prev => ({
      ...prev,
      branches: prev.branches.map(b => b.id === activeBranch ? { ...b, [field]: value } : b),
    }));
  };

  const updateSelection = (classificationLabel, value) => {
    setState(prev => ({
      ...prev,
      laborSelection: {
        ...prev.laborSelection,
        [activeBranch]: {
          ...(prev.laborSelection?.[activeBranch] || {}),
          [classificationLabel]: value,
        },
      },
    }));
  };

  const resetAllToAverage = () => {
    setState(prev => ({
      ...prev,
      laborSelection: {
        ...prev.laborSelection,
        [activeBranch]: { Foreman: 'AVG', Climber: 'AVG', Groundman: 'AVG', 'Other-1': 'AVG', 'Other-2': 'AVG' },
      },
    }));
  };

  // Compute labor cost build-up for each classification at this branch
  const rows = state.whatIf.classifications.map(cls => {
    const reg = computeLaborCost(state, activeBranch, cls.label, 'reg');
    const ot  = computeLaborCost(state, activeBranch, cls.label, 'ot');
    return { cls, reg, ot };
  });

  // Build dropdown options for each classification slot:
  //  - "Average [empClass]" first
  //  - then every employee in this branch whose classification matches the mapped employee class
  const buildOptions = (classificationLabel) => {
    const empClass = EMP_CLASS_MAP[classificationLabel] || classificationLabel;
    const roster = state.employees[activeBranch] || [];
    const matching = roster.filter(e => e.classification === empClass);
    return [
      { value: 'AVG', label: `Average ${empClass}`, isAverage: true, count: matching.length },
      ...matching.map(e => ({
        value: empKey(e),
        label: `${e.last}, ${e.first}`,
        sub: `#${e.empNo} · ${fmt$(Number(e.payPerHr))}/hr + ${fmt$(Number(e.supp))} supp`,
        isAverage: false,
      })),
    ];
  };

  // Count of pinned (non-average) selections for this branch
  const branchSel = state.laborSelection?.[activeBranch] || {};
  const pinnedCount = Object.values(branchSel).filter(v => v && v !== 'AVG').length;

  return (
    <div>
      <PageHeader
        title="Labor Cost Build-Up"
        subtitle="Fully-loaded hourly cost by classification. Choose the branch average — or pin a specific named employee — to drive each row. Both options use the same loading factors."
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {state.branches.map(b => (
          <button
            key={b.id}
            className={`branch-pill ${activeBranch === b.id ? 'active' : ''}`}
            onClick={() => setActiveBranch(b.id)}
          >
            <MapPin size={12} /> {b.name} · {b.state}
          </button>
        ))}
      </div>

      {/* Branch loading factors */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <SectionTitle>{branch.label} · Loading factors</SectionTitle>
        <FieldGrid>
          <NumField label="Workers' Comp Rate" value={branch.wcRate} disabled={!isAdmin} onChange={v => updateBranch('wcRate', v)} suffix="(decimal)" />
          <NumField label="P/R Taxes Rate"     value={branch.prRate} disabled={!isAdmin} onChange={v => updateBranch('prRate', v)} suffix="(decimal)" />
          <NumField label="Medical / Hour"     value={branch.medical} disabled={!isAdmin} onChange={v => updateBranch('medical', v)} prefix="$" />
          <NumField label="Overhead Burden / Hour" value={branch.overhead} disabled={!isAdmin} onChange={v => updateBranch('overhead', v)} prefix="$" />
          <NumField label="Storm Bonus / 8 Hrs (OT only)" value={branch.stormBonus} disabled={!isAdmin} onChange={v => updateBranch('stormBonus', v)} prefix="$" />
        </FieldGrid>
        {!isAdmin && (
          <p style={{ fontSize: 11, color: C.muted, marginTop: 12, fontStyle: 'italic' }}>
            <AlertCircle size={11} style={{ verticalAlign: 'middle' }} /> Switch to Admin mode to edit loading factors.
          </p>
        )}
      </div>

      {/* Wage source picker */}
      <div className="card" style={{ padding: 20, marginBottom: 20, background: C.butter }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <SectionTitle style={{ margin: 0 }}>Wage source per classification</SectionTitle>
            <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0', maxWidth: 580 }}>
              For each row, pick the branch <strong>Average</strong> for that role, or a specific employee from the {branch.name} roster.
              Pinning an individual is useful when you know exactly who'd be on the crew.
            </p>
          </div>
          {pinnedCount > 0 && (
            <button className="btn-ghost" onClick={resetAllToAverage}>
              <Users size={13} /> Reset all to Average
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {state.whatIf.classifications.map(cls => {
            const options = buildOptions(cls.label);
            const currentValue = branchSel[cls.label] || 'AVG';
            const isPinned = currentValue !== 'AVG';
            const currentOption = options.find(o => o.value === currentValue);
            return (
              <div key={cls.id} style={{
                background: C.paper, borderRadius: 8,
                padding: 14,
                border: isPinned ? `2px solid ${C.ochre}` : `1px solid ${C.border}`,
                position: 'relative',
              }}>
                {isPinned && (
                  <div style={{
                    position: 'absolute', top: -8, right: 10,
                    background: C.ochre, color: C.paper,
                    fontSize: 9, padding: '2px 8px', borderRadius: 999,
                    fontWeight: 700, letterSpacing: '0.08em',
                  }}>PINNED</div>
                )}
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {cls.label}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2, marginBottom: 8 }}>
                  → {EMP_CLASS_MAP[cls.label] || cls.label}
                </div>
                <select
                  className="select-field"
                  value={currentValue}
                  onChange={e => updateSelection(cls.label, e.target.value)}
                  style={{ fontSize: 12 }}
                >
                  {options.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.isAverage
                        ? `📊 ${o.label}${o.count > 0 ? ` (${o.count})` : ''}`
                        : `👤 ${o.label}`}
                    </option>
                  ))}
                </select>
                {currentOption && !currentOption.isAverage && currentOption.sub && (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontFamily: 'DM Mono' }}>
                    {currentOption.sub}
                  </div>
                )}
                {currentOption && currentOption.isAverage && options.length > 1 && (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                    Avg of {options.length - 1} on roster
                  </div>
                )}
                {options.length === 1 && (
                  <div style={{ fontSize: 10, color: C.rust, marginTop: 6, fontStyle: 'italic' }}>
                    No employees in this class
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost build-up table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: C.pine, color: C.paper }}>
          <SectionTitle style={{ margin: 0, color: C.paper }}>Hourly cost build-up</SectionTitle>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                <th>Classification</th>
                <th>Wage source</th>
                <th className="num">Wage Used</th>
                <th className="num">WC Ins.</th>
                <th className="num">P/R Tax</th>
                <th className="num">Medical</th>
                <th className="num">Vac/Hol</th>
                <th className="num">Overhead</th>
                <th className="num" style={{ background: C.butter }}>REG TOTAL</th>
                <th className="num" style={{ background: C.butter }}>OT TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.cls.id}>
                  <td style={{ fontWeight: 600 }}>{r.cls.label}</td>
                  <td>
                    {r.reg && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600,
                          letterSpacing: '0.05em',
                          background: r.reg.source === 'EMPLOYEE' ? C.ochre + '20' : C.fern + '40',
                          color: r.reg.source === 'EMPLOYEE' ? C.ochre : C.pine,
                        }}>
                          {r.reg.source === 'EMPLOYEE' ? 'PINNED' : 'AVG'}
                        </span>
                        <span style={{ fontSize: 12, color: C.ink }}>{r.reg.sourceLabel}</span>
                      </div>
                    )}
                  </td>
                  <td className="num">{r.reg ? fmt$(r.reg.wagesUsed) : '—'}</td>
                  <td className="num">{r.reg ? fmt$(r.reg.wc) : '—'}</td>
                  <td className="num">{r.reg ? fmt$(r.reg.payroll) : '—'}</td>
                  <td className="num">{r.reg ? fmt$(r.reg.medical) : '—'}</td>
                  <td className="num">{r.reg ? fmt$(r.reg.vacHol) : '—'}</td>
                  <td className="num">{r.reg ? fmt$(r.reg.overhead) : '—'}</td>
                  <td className="num" style={{ background: C.butter, fontWeight: 700, color: C.pine }}>
                    {r.reg ? fmt$(r.reg.total) : '—'}
                  </td>
                  <td className="num" style={{ background: C.butter, fontWeight: 700, color: C.rust }}>
                    {r.ot ? fmt$(r.ot.total) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: C.cream, borderRadius: 6, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        <strong style={{ color: C.ink }}>Note:</strong> selections here flow into the Crew Bid Sheet automatically.
        If you pin "FLORES, ALEJANDRO" as the Foreman on the {branch.name} labor row, his rate is what the bid sheet uses for any Foreman slot in that branch's crew.
      </div>
    </div>
  );
}

// ============================================================
// EQUIPMENT TAB
// ============================================================
function EquipmentTab({ state, setState, isAdmin }) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const updateEq = (idx, field, value) => {
    setState(prev => ({
      ...prev,
      equipment: prev.equipment.map((e, i) =>
        i === idx ? { ...e, [field]: field === 'truck' || field === 'name' ? value : (parseFloat(value) || 0) } : e
      ),
    }));
  };
  const deleteEq = (idx) => {
    if (!confirm('Remove this equipment from the fleet?')) return;
    setState(prev => ({ ...prev, equipment: prev.equipment.filter((_, i) => i !== idx) }));
  };
  const addEq = (eq) => {
    setState(prev => ({ ...prev, equipment: [...prev.equipment, eq] }));
    setShowAdd(false);
  };

  const filtered = state.equipment
    .map((eq, idx) => ({ ...eq, _idx: idx }))
    .filter(eq =>
      !search ||
      eq.truck.toString().includes(search) ||
      eq.name.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>
      <PageHeader
        title="Equipment Fleet"
        subtitle="Per-asset hourly cost build-up — fuel, maintenance, licensing. The crew bid sheet pulls from this list."
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <input
          type="text"
          placeholder="Search by truck # or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field"
          style={{ maxWidth: 320 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.muted }}>{filtered.length} of {state.equipment.length} assets</span>
          {isAdmin && (
            <button className="btn-accent" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add equipment
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 600 }}>
          <table style={{ minWidth: 980 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: 80 }}>Truck #</th>
                <th>Equipment</th>
                <th className="num">Fuel gph</th>
                <th className="num">Annual Maint.</th>
                <th className="num">Annual Lic.</th>
                <th className="num">Days/yr</th>
                <th className="num" style={{ background: C.butter }}>Cost / Hr</th>
                <th className="num" style={{ background: C.butter }}>Day Cost</th>
                {isAdmin && <th style={{ width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(eq => {
                const calc = computeEquipCost(eq, state.whatIf.fuelPerGal);
                return (
                  <tr key={eq.truck + '-' + eq.name}>
                    <td style={{ fontFamily: 'DM Mono', fontWeight: 600 }}>#{eq.truck}</td>
                    <td>
                      {isAdmin
                        ? <input className="input-field" value={eq.name} onChange={e => updateEq(eq._idx, 'name', e.target.value)} />
                        : eq.name}
                    </td>
                    <td className="num">
                      {isAdmin
                        ? <input className="input-field num" type="number" step="0.1" value={eq.fuelGph} onChange={e => updateEq(eq._idx, 'fuelGph', e.target.value)} />
                        : eq.fuelGph.toFixed(1)}
                    </td>
                    <td className="num">
                      {isAdmin
                        ? <input className="input-field num" type="number" step="1" value={eq.annMaint} onChange={e => updateEq(eq._idx, 'annMaint', e.target.value)} />
                        : fmt$0(eq.annMaint)}
                    </td>
                    <td className="num">
                      {isAdmin
                        ? <input className="input-field num" type="number" step="1" value={eq.annLic} onChange={e => updateEq(eq._idx, 'annLic', e.target.value)} />
                        : fmt$0(eq.annLic)}
                    </td>
                    <td className="num">
                      {isAdmin
                        ? <input className="input-field num" type="number" step="1" value={eq.daysUsed} onChange={e => updateEq(eq._idx, 'daysUsed', e.target.value)} />
                        : eq.daysUsed}
                    </td>
                    <td className="num" style={{ background: C.butter, fontWeight: 700, color: C.pine }}>
                      {fmt$(calc.total)}
                    </td>
                    <td className="num" style={{ background: C.butter, fontWeight: 600 }}>
                      {fmt$0(calc.totalDay)}
                    </td>
                    {isAdmin && (
                      <td>
                        <button className="btn-danger" onClick={() => deleteEq(eq._idx)} title="Remove">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddEquipmentModal onAdd={addEq} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddEquipmentModal({ onAdd, onClose }) {
  const [eq, setEq] = useState({ truck: '', name: '', fuelGph: 0, annMaint: 0, annLic: 0, daysUsed: 220 });
  const upd = (k, v) => setEq(prev => ({ ...prev, [k]: k === 'truck' || k === 'name' ? v : (parseFloat(v) || 0) }));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#00000080',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div className="card" style={{ padding: 28, width: 480, background: C.paper }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'Spline Sans', fontSize: 22, fontWeight: 700, margin: '0 0 16px', color: C.ink }}>
          Add equipment
        </h3>
        <FieldGrid>
          <Field label="Truck #" type="text" value={eq.truck} onChange={v => upd('truck', v)} />
          <Field label="Equipment name" type="text" value={eq.name} onChange={v => upd('name', v)} />
          <NumField label="Fuel gph" value={eq.fuelGph} onChange={v => upd('fuelGph', v)} />
          <NumField label="Days used / yr" value={eq.daysUsed} onChange={v => upd('daysUsed', v)} />
          <NumField label="Annual Maintenance" value={eq.annMaint} onChange={v => upd('annMaint', v)} prefix="$" />
          <NumField label="Annual Licensing" value={eq.annLic} onChange={v => upd('annLic', v)} prefix="$" />
        </FieldGrid>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onAdd(eq)} disabled={!eq.truck || !eq.name}>
            <Save size={14} /> Add to fleet
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EMPLOYEES TAB
// ============================================================
function EmployeesTab({ state, setState, isAdmin, activeBranch, setActiveBranch }) {
  const [showAdd, setShowAdd] = useState(false);
  const branch = state.branches.find(b => b.id === activeBranch);
  const list = state.employees[activeBranch] || [];

  const update = (idx, field, value) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const v = (field === 'payPerHr' || field === 'supp') ? (parseFloat(value) || 0) : value;
      next.employees[activeBranch][idx][field] = v;
      return next;
    });
  };
  const remove = (idx) => {
    if (!confirm('Remove this employee?')) return;
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.employees[activeBranch].splice(idx, 1);
      return next;
    });
  };
  const add = (emp) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.employees[activeBranch]) next.employees[activeBranch] = [];
      next.employees[activeBranch].push(emp);
      return next;
    });
    setShowAdd(false);
  };

  // Branch averages (the actual numbers the crew sheet uses!)
  const classifications = ['Foreman', 'Climber', 'Groundperson', 'Spray Tech', 'Lawn Tech'];
  const averages = classifications.map(c => ({
    label: c,
    avg: avgEmployee(state.employees, activeBranch, c),
  }));

  return (
    <div>
      <PageHeader
        title="Employee Roster"
        subtitle="Branch averages by classification drive the labor cost build-up. Edit individuals here; the crew bid sheet recalculates automatically."
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {state.branches.map(b => (
          <button
            key={b.id}
            className={`branch-pill ${activeBranch === b.id ? 'active' : ''}`}
            onClick={() => setActiveBranch(b.id)}
          >
            <MapPin size={12} /> {b.name} · {(state.employees[b.id] || []).length}
          </button>
        ))}
      </div>

      {/* Branch averages */}
      <div className="card" style={{ padding: 20, marginBottom: 20, background: C.cream }}>
        <SectionTitle>Branch averages · {branch.name}</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {averages.map(a => (
            <div key={a.label} style={{
              padding: 14, background: C.paper,
              borderRadius: 6, border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                {a.label}
              </div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 18, fontWeight: 600, color: C.pine, marginTop: 4 }}>
                {a.avg ? fmt$(a.avg.payPerHr) : '—'}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                + {a.avg ? fmt$(a.avg.supp) : '—'} supp · {a.avg ? `${a.avg.count} ppl` : 'no data'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roster table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <SectionTitle>Roster ({list.length})</SectionTitle>
        {isAdmin && (
          <button className="btn-accent" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add employee
          </button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 600 }}>
          <table style={{ minWidth: 920 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: 90 }}>Emp #</th>
                <th>Classification</th>
                <th>Last Name</th>
                <th>First Name</th>
                <th className="num">Pay / Hr</th>
                <th className="num">Supp / Hr</th>
                <th className="num">Total</th>
                {isAdmin && <th style={{ width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((emp, idx) => (
                <tr key={idx}>
                  <td style={{ fontFamily: 'DM Mono', fontSize: 12 }}>
                    {isAdmin
                      ? <input className="input-field" style={{ width: 80 }} value={emp.empNo} onChange={e => update(idx, 'empNo', e.target.value)} />
                      : emp.empNo}
                  </td>
                  <td>
                    {isAdmin ? (
                      <select className="select-field" value={emp.classification} onChange={e => update(idx, 'classification', e.target.value)}>
                        {['Foreman','Climber','Groundperson','Spray Tech','Lawn Tech','Operations Manager','Nursery- Field','Nursery- Mulch Yard','Nursery- Driver'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : emp.classification}
                  </td>
                  <td>
                    {isAdmin
                      ? <input className="input-field" value={emp.last} onChange={e => update(idx, 'last', e.target.value)} />
                      : emp.last}
                  </td>
                  <td>
                    {isAdmin
                      ? <input className="input-field" value={emp.first} onChange={e => update(idx, 'first', e.target.value)} />
                      : emp.first}
                  </td>
                  <td className="num">
                    {isAdmin
                      ? <input className="input-field num" type="number" step="0.01" value={emp.payPerHr} onChange={e => update(idx, 'payPerHr', e.target.value)} />
                      : fmt$(emp.payPerHr)}
                  </td>
                  <td className="num">
                    {isAdmin
                      ? <input className="input-field num" type="number" step="0.01" value={emp.supp} onChange={e => update(idx, 'supp', e.target.value)} />
                      : fmt$(emp.supp)}
                  </td>
                  <td className="num" style={{ fontWeight: 600, color: C.pine }}>
                    {fmt$(Number(emp.payPerHr) + Number(emp.supp))}
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="btn-danger" onClick={() => remove(idx)} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddEmployeeModal onAdd={add} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddEmployeeModal({ onAdd, onClose }) {
  const [emp, setEmp] = useState({ empNo: '', classification: 'Foreman', last: '', first: '', payPerHr: 0, supp: 0 });
  const upd = (k, v) => setEmp(prev => ({ ...prev, [k]: (k === 'payPerHr' || k === 'supp') ? (parseFloat(v) || 0) : v }));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#00000080',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div className="card" style={{ padding: 28, width: 480, background: C.paper }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'Spline Sans', fontSize: 22, fontWeight: 700, margin: '0 0 16px', color: C.ink }}>
          Add employee
        </h3>
        <FieldGrid>
          <Field label="Employee #" type="text" value={emp.empNo} onChange={v => upd('empNo', v)} />
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Classification
            </label>
            <select className="select-field" value={emp.classification} onChange={e => upd('classification', e.target.value)}>
              {['Foreman','Climber','Groundperson','Spray Tech','Lawn Tech','Operations Manager','Nursery- Field','Nursery- Mulch Yard','Nursery- Driver'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Field label="Last name" type="text" value={emp.last} onChange={v => upd('last', v)} />
          <Field label="First name" type="text" value={emp.first} onChange={v => upd('first', v)} />
          <NumField label="Pay / hr" value={emp.payPerHr} onChange={v => upd('payPerHr', v)} prefix="$" />
          <NumField label="Supplemental / hr" value={emp.supp} onChange={v => upd('supp', v)} prefix="$" />
        </FieldGrid>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onAdd(emp)} disabled={!emp.last || !emp.first}>
            <Save size={14} /> Add to roster
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REUSABLE BITS
// ============================================================

function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{
        fontFamily: 'Spline Sans', fontSize: 36, fontWeight: 700,
        margin: 0, color: C.ink, letterSpacing: '-0.02em',
      }}>{title}</h1>
      <p style={{ color: C.muted, fontSize: 15, marginTop: 6, maxWidth: 700 }}>{subtitle}</p>
    </div>
  );
}

function SectionTitle({ children, style }) {
  return (
    <h2 style={{
      fontFamily: 'Spline Sans', fontSize: 13,
      fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: C.pine,
      margin: '0 0 14px', ...style,
    }}>{children}</h2>
  );
}

function FieldGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <input
        className="input-field"
        type={type}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function NumField({ label, value, onChange, prefix, suffix, disabled }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
        {label} {suffix && <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none' }}>{suffix}</span>}
      </label>
      <div style={{ position: 'relative' }}>
        {prefix && <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13, fontFamily: 'DM Mono' }}>{prefix}</span>}
        <input
          className="input-field num"
          type="number"
          step="0.0001"
          value={value}
          disabled={disabled}
          style={{ paddingLeft: prefix ? 24 : 10, textAlign: 'right' }}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

function AdminOnlyMessage({ tabName }) {
  return (
    <div style={{
      padding: 60, textAlign: 'center',
      background: C.cream, borderRadius: 12,
      border: `1px dashed ${C.borderDk}`, maxWidth: 600, margin: '60px auto',
    }}>
      <Settings size={48} color={C.muted} style={{ margin: '0 auto 16px', display: 'block' }} />
      <h2 style={{ fontFamily: 'Spline Sans', fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: C.ink }}>
        {tabName} — Admin only
      </h2>
      <p style={{ color: C.muted, fontSize: 14, margin: '0 0 20px' }}>
        Global assumptions live here. Switch to <strong>Admin</strong> mode in the header to view and edit.
      </p>
    </div>
  );
}
