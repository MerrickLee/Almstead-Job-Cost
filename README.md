# Almstead Product Costing — Antigravity Build Prompt

> **How to use:** Paste this entire document into Antigravity as the initial project prompt. Every section is authoritative — formulas, brand tokens, schemas, and acceptance criteria are exact, not suggestions.

---

## 0. How to Use This Prompt in Antigravity

This document is a single, self-contained build specification.

### Recommended Antigravity workflow

- Create a new workspace and select the agent that best handles full-stack TypeScript with database migrations (typically the longest-context coding agent).
- Paste this entire document as the project brief.
- Instruct the agent to first scaffold the project, then implement the Supabase schema (Section 6), then the formula engine (Section 5), then the UI screens (Section 7), then the analytics layer (Section 9).
- Have the agent verify Section 11 acceptance criteria at the end of each milestone.
- All numeric defaults in Section 3 should be loaded into Supabase as seed data on first run.

### Agent rules of engagement

- **Never deviate from the formula chain in Section 5** — these mirror a working Excel model that has been verified against payroll. Off-by-one errors here cause real money to be miscoded.
- **Treat the brand tokens in Section 4 as a contract.** Spline Sans for UI, DM Mono for tabular numbers, the green palette anchored on `#0E3A28` (pine) and `#0E7C3A` (emerald).
- **Every editable field must have a corresponding Supabase write path and Amplitude event.**
- **Optimistic UI updates everywhere** — Excel feels instant; the web app must too.

---

## 1. Product Overview

Almstead Product Costing is an internal pricing and bidding tool used by sales managers and branch leadership across Almstead's four branches (New Rochelle NY, Hawthorne NY, Stamford CT, North Haledon NJ). Given a crew configuration — three equipment slots and five labor slots — the tool produces a fully-loaded hourly cost, a configurable profit markup, and a billable hourly and 8-hour-day rate. It supports both regular-time and overtime pricing scenarios.

Today this lives in a single Excel workbook maintained by hand. We are rebuilding it as a multi-user web application with persistent data in Supabase, role-based access (Sales vs. Admin), and product analytics so we can see how the bidding workflow is actually used.

### 1.1 Primary users

- Sales managers and estimators at each branch — build crews and read out a quote.
- Branch leadership — same as above, plus override individual employee assignments.
- Operations / Finance (admin role) — maintain the underlying assumptions, equipment fleet, employee roster, and branch loading factors.

### 1.2 Primary jobs to be done

- Build a crew (equipment + labor) and read out a billable hourly + day rate in under 30 seconds.
- Toggle between regular-time and overtime pricing for the same crew.
- Pin a specific named employee to a labor slot when crew composition is known.
- Update certified wages, fuel price, and profit target globally and have every bid recalculate.
- Add or update equipment and employees as the fleet and roster change.
- Save and revisit named bids; export a bid summary as PDF.

---

## 2. Tech Stack & Project Setup

### 2.1 Required stack

| Layer          | Technology                                                       | Notes                                                                  |
| -------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Framework      | Next.js 14+ (App Router)                                         | Server components default; client components where state lives         |
| Language       | TypeScript (strict)                                              | No `any`; explicit types on every Supabase row                         |
| Styling        | Tailwind CSS v3                                                  | Configured with the brand tokens in Section 4                          |
| UI primitives  | shadcn/ui                                                        | Dropdowns, dialogs, tables, toasts — themed to brand                   |
| Icons          | Lucide React                                                     |                                                                        |
| Database       | Supabase (Postgres + RLS)                                        | Schema in Section 6                                                    |
| Auth           | Supabase Auth                                                    | Email/password + magic link; roles via JWT claims                      |
| Forms          | React Hook Form + Zod                                            | Zod schemas mirror DB constraints                                      |
| State          | React Server Components + Zustand for ephemeral client state     | Bid drafts can be client-only; saved bids hit the DB                   |
| Analytics #1   | Google Analytics 4                                               | Page-level + conversions (bid saved, bid exported)                     |
| Analytics #2   | Amplitude                                                        | Product-level event taxonomy; user identification by Supabase user ID  |
| PDF export     | `@react-pdf/renderer`                                            | Server-side render for clean export                                    |
| Hosting        | Vercel                                                           | Edge runtime where possible; Supabase as the data plane                |

### 2.2 Environment variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never exposed

NEXT_PUBLIC_GA_MEASUREMENT_ID=    # G-XXXXXXXXXX
NEXT_PUBLIC_AMPLITUDE_API_KEY=

NEXT_PUBLIC_APP_URL=https://costing.almstead.com
```

### 2.3 Project structure

```
app/
  (auth)/
    login/page.tsx
  (app)/                     # authenticated routes
    layout.tsx               # shell with header, tabs, footer
    crews/page.tsx           # Crew Bid Sheet (default landing)
    crews/[bidId]/page.tsx   # saved bid
    what-if/page.tsx         # global assumptions (admin)
    labor/page.tsx           # branch loading factors + wage source picker
    equipment/page.tsx       # fleet management
    employees/page.tsx       # roster management
  api/
    bids/route.ts            # POST save bid
    export/[bidId]/route.ts  # GET PDF
components/
  brand/                     # Logo, BrandHeader, FormBadge
  bid/                       # CrewBuilder, EquipmentSlot, LaborSlot, MetricCard
  forms/                     # NumberField, PercentField, MoneyField
  data/                      # DataTable wrappers themed to brand
lib/
  supabase/client.ts
  supabase/server.ts
  formulas/                  # the formula engine — Section 5
    labor.ts
    equipment.ts
    crew.ts
  analytics/
    ga.ts                    # GA4 wrapper
    amplitude.ts             # Amplitude wrapper
    events.ts                # typed event catalog
types/db.ts                  # generated Supabase types
```

---

## 3. Seed Data & Global Constants

All values below are the current production values from the source workbook (effective 5/14/2026). Load these into Supabase as the initial seed.

### 3.1 Global assumptions ("What If Conditions")

| Key                  | Value | Description                                                                |
| -------------------- | ----- | -------------------------------------------------------------------------- |
| `profit_pct`         | 0.25  | Profit markup applied to total hourly cost (decimal, 0.25 = 25%)           |
| `contrib_margin_pct` | 1.00  | Multiplier on the per-branch overhead burden                               |
| `fuel_per_gal`       | 5.50  | Diesel price per gallon (USD), used for every equipment fuel calc          |
| `emergency_mult`     | 2.00  | Multiplier for emergency / storm callout pricing                           |

### 3.2 Labor classifications (with certified wages)

Certified wages are NY DOL prevailing wage rates for Westchester County Heavy & Highway. "Other-1" and "Other-2" are non-certified slots mapped to PHC Spray Tech and Lawn Tech respectively — their certified-wage cells are zero by design.

| Classification | Reg Wage | Reg Supp | OT Wage | OT Supp | Description                          |
| -------------- | -------- | -------- | ------- | ------- | ------------------------------------ |
| Foreman        | 50.29    | 29.13    | 75.435  | 29.13   | Westchester Heavy & Highway GR III   |
| Climber        | 50.29    | 29.13    | 75.435  | 29.13   | Westchester Heavy & Highway GR III   |
| Groundman      | 49.56    | 29.13    | 74.34   | 29.13   | Westchester Heavy & Highway GR V     |
| Other-1        | 0        | 0        | 0       | 0       | PHC Spray Tech (non-certified)       |
| Other-2        | 0        | 0        | 0       | 0       | Lawn Tech (non-certified)            |

### 3.3 Branches & loading factors

| Branch         | State | WC Rate | P/R Tax | Medical/hr | Overhead/hr | Storm/8h |
| -------------- | ----- | ------- | ------- | ---------- | ----------- | -------- |
| New Rochelle   | NY    | 0.0617  | 0.1226  | $0         | $48.06      | $0       |
| Hawthorne      | NY    | 0.0617  | 0.1544  | $0         | $43.80      | $0       |
| Stamford       | CT    | 0.0526  | 0.1712  | $0         | $41.13      | $0       |
| North Haledon  | NJ    | 0.1053  | 0.2131  | $0         | $49.66      | $0       |

**Sources (per workbook notes):**

- Salary numbers — payroll run of 5/14/2026
- Workers' comp — 2026 Budget as of 5/14/2026
- Overhead Burden — Total Fixed Cost per hour from Master Budget – ARBOR w/p 2026
- Payroll taxes — 2026 Budget as of 5/14/2026

### 3.4 Standard constants

- Standard workday = 8 hours
- Standard equipment annualization = 220 8-hour days per year
- Vacation / Holiday accrual = 10% of base wage (applied in Labor formula)
- Equipment lookup dropdown shows label format: `#{truck_number} {equipment_name}`
- Workers' comp on overtime is calculated on straight-time wages, per NY convention

### 3.5 Initial employee roster

Seed the database with the complete roster from the workbook. The full list is in the source Excel file under the Employees tab. Below is the row count expected per branch — confirm these match after seeding.

| Branch         | Headcount             | Includes Ghent Nursery sub-roster?                                                                                                  |
| -------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| New Rochelle   | 31 (+4 Ghent Nursery) | Yes — Ghent Nursery counted as part of New Rochelle but classified separately (Nursery- Field, Nursery- Mulch Yard, Nursery- Driver) |
| Hawthorne      | 14                    | No                                                                                                                                  |
| Stamford       | 17                    | No                                                                                                                                  |
| North Haledon  | 9                     | No                                                                                                                                  |

Per employee, store: `emp_no`, `branch_id`, `classification`, `last_name`, `first_name`, `pay_per_hr`, `supplemental_per_hr`. The full reference data is in the original Excel; load it via a one-time CSV import script. After seeding, verify branch averages match the workbook's `AVERAGEIF` outputs to within $0.01.

### 3.6 Initial equipment fleet

The workbook lists ~205 fleet assets. Seed all of them. Per asset, store: `truck_number`, `equipment_name`, `fuel_gph`, `annual_maint`, `annual_lic`, `days_used_per_year` (default 220). The full list is in the source Excel file; import via CSV.

---

## 4. Brand & Design System

Visual identity is non-negotiable here. Almstead has a clear brand guide and this app is internal-facing for the company — it must feel like an Almstead product.

### 4.1 Color tokens

Define these as CSS custom properties in `globals.css` and as a `tailwind.config` theme extension. Use the green palette as primary; ochre/yellow as accent; rust for warnings; never use generic blue UI primaries.

| Token       | Hex       | Usage                                                                            |
| ----------- | --------- | -------------------------------------------------------------------------------- |
| `forest`    | `#0F2419` | Header bar, footer, deepest text                                                 |
| `pine`      | `#0E3A28` | Primary buttons, total rows, headings                                            |
| `emerald`   | `#0E7C3A` | Logo green, primary accents, billable-rate card (the moment that matters)        |
| `sage`      | `#7FA589` | Muted secondary surfaces                                                         |
| `fern`      | `#B8D9A8` | Subtle backgrounds, badges on the dark header                                    |
| `mist`      | `#D9E8C9` | Light section dividers                                                           |
| `lime`      | `#7DBC3D` | Positive deltas, growth indicators                                               |
| `yellow`    | `#F2DD2C` | Admin-mode signal, "QUOTE THIS" badge, attention prompts                         |
| `ochre`     | `#B88A2A` | Secondary CTAs ("Add", "Pin employee"), pinned-employee accents                  |
| `amber`     | `#C99A48` | Hover state for ochre buttons                                                    |
| `rust`      | `#C6471F` | OT mode indicator, destructive actions, warnings                                 |
| `clay`      | `#B17E4F` | Tertiary accents                                                                 |
| `rose`      | `#A86D5F` | Soft warning surfaces                                                            |
| `paper`     | `#FAFAF7` | App background                                                                   |
| `cream`     | `#F4F2EA` | Card hover, alt-row surfaces                                                     |
| `butter`    | `#FBF5E3` | Input field fill — distinguishes editable from calculated                        |
| `border`    | `#E5E3DA` | Default border                                                                   |
| `border-dk` | `#C9C5B6` | Emphasized border                                                                |
| `muted`     | `#6B6A5F` | Secondary text                                                                   |

### 4.2 Typography

- **Headings & UI text:** Spline Sans (Google Fonts) — weights 400, 500, 600, 700
- **Tabular numbers:** DM Mono — used for currency, percentages, table cells. Crucial because Spline Sans does not have a tabular-figure variant; numbers will not align without a monospace.
- **Wordmark:** Georgia serif at large sizes (this is what the Almstead wordmark uses)
- **Base body size:** 14px / leading-relaxed; H1: 36px bold tight tracking; section titles: 13px uppercase letter-spaced

Load via `next/font` (preferred) or a Google Fonts `<link>`. Cache aggressively.

### 4.3 Logo treatment

Reproduce the Almstead logo at the top-left of the app header:

- 44×44 rounded-square in emerald (`#0E7C3A`) with a serif lowercase "a" in white
- A 14×14 fern-green circle at the bottom-right of the square, with a 2px forest border, representing the tree dot
- Wordmark to the right: "ALMSTEAD" in Georgia serif, all caps, 22px bold, with "TREE, SHRUB & LAWN CARE" underneath in 9px fern-green, letter-spaced 0.18em

### 4.4 Component conventions

- **Buttons:** pill-shaped (`border-radius: 999px`), 10px×20px padding, 12px uppercase text, 600 weight, 0.08em letter-spacing
- **Primary button:** pine fill, paper text; hover emerald
- **Accent button:** ochre fill, paper text; hover amber
- **Ghost button:** transparent, border-dk outline, pine on hover
- **Editable inputs:** butter fill, border-dk outline; focus ring is 3px fern (`B8D9A880`)
- **Calculated/readonly cells:** transparent, no border — distinguishes them from inputs immediately
- **Table totals row:** pine fill, paper text, rounded corners on the outer cells
- **Branch pills:** rounded-full chips with `MapPin` icon; pine fill when active
- **"QUOTE THIS" badge:** 9px yellow pill on the billable-rate metric card, top-right corner

### 4.5 Layout

- Max content width 1480px, centered, 32px horizontal padding
- Header: forest background, 18×32 padding, sticky-on-scroll
- Tabs: 12×20 padding, bottom-border yellow when active, fern text when inactive
- Cards: paper background, 1px border, 8px radius
- Page header: H1 in 36px 700 with subtitle in 15px muted, max-width 700px

---

## 5. Formula Engine (the heart of the app)

Every formula below is verified against the source Excel workbook. These formulas are reproduced exactly — they have been validated against payroll runs and have real-money consequences. **Do not modify; do not optimize away intermediate variables; do not change rounding behavior.** Implement them in TypeScript under `lib/formulas/` with full unit tests.

### 5.1 Equipment hourly cost

For each piece of equipment, the total hourly cost is the sum of fuel, maintenance, and licensing/insurance amortized over the year. Inputs are loaded from the equipment row plus the global fuel price.

```typescript
// lib/formulas/equipment.ts

type EquipmentRow = {
  truck_number: string;
  equipment_name: string;
  fuel_gph: number;          // gallons per hour
  annual_maint: number;      // USD per year
  annual_lic: number;        // USD per year (license + insurance + misc)
  days_used_per_year: number;// default 220
};

export function computeEquipmentCost(eq: EquipmentRow, fuelPerGal: number) {
  const fuelCost = eq.fuel_gph * fuelPerGal;
  const maintHr  = eq.days_used_per_year > 0
    ? eq.annual_maint / (eq.days_used_per_year * 8)
    : 0;
  const licHr    = eq.days_used_per_year > 0
    ? eq.annual_lic   / (eq.days_used_per_year * 8)
    : 0;
  const totalPerHr = fuelCost + maintHr + licHr;
  const totalPerDay = totalPerHr * 8;
  return { fuelCost, maintHr, licHr, totalPerHr, totalPerDay };
}
```

**Source workbook equivalents (Equipment sheet):**

```
Q8  = O8 * P8                            // fuel_gph * fuel_per_gal
U8  = S8 / (T8 * 8)                      // annual_maint / (days * 8)
Y8  = W8 / (X8 * 8)                      // annual_lic   / (days * 8)
AA8 = Q8 + U8 + Y8                       // hourly total
AB8 = AA8 * 8                            // 8-hr day total
```

### 5.2 Labor hourly cost

The labor chain is the most important code in the system. Each labor classification at each branch produces a fully-loaded hourly cost, separately for regular-time and overtime.

#### 5.2.1 Wage source resolution

Each (branch, classification) labor slot can be backed by either:

- **AVERAGE:** the branch-level average wage and supplemental for that employee classification, computed as the mean across all matching employees on that branch's roster
- **EMPLOYEE:** a specific named employee from that branch ("pinned")

Classification → employee classification mapping (mirrors workbook):

```typescript
const EMP_CLASS_MAP = {
  'Foreman':   'Foreman',
  'Climber':   'Climber',
  'Groundman': 'Groundperson',     // note: spelling difference
  'Other-1':   'Spray Tech',       // PHC Spray Tech
  'Other-2':   'Lawn Tech',
};
```

```typescript
type LaborSelection = 'AVG' | string;  // 'AVG' or employee_id (uuid)

export function resolveWageSource(
  branchId: string,
  classificationLabel: string,
  selection: LaborSelection,
  employees: EmployeeRow[],
) {
  const empClass = EMP_CLASS_MAP[classificationLabel];
  if (selection === 'AVG') {
    const matching = employees.filter(
      e => e.branch_id === branchId && e.classification === empClass
    );
    if (matching.length === 0)
      return { source: 'NONE', payPerHr: 0, supp: 0, count: 0 };
    const payPerHr = mean(matching.map(e => e.pay_per_hr));
    const supp     = mean(matching.map(e => e.supplemental_per_hr));
    return { source: 'AVG', label: `Average ${empClass}`,
             payPerHr, supp, count: matching.length };
  }
  const emp = employees.find(e => e.id === selection);
  if (!emp) return resolveWageSource(branchId, classificationLabel, 'AVG', employees);
  return { source: 'EMPLOYEE', label: `${emp.last_name}, ${emp.first_name}`,
           payPerHr: emp.pay_per_hr, supp: emp.supplemental_per_hr, count: 1 };
}
```

#### 5.2.2 Labor cost chain (regular time and overtime)

This is the core formula chain. Letter-suffix variables match the Excel column letters for auditability. **Implement exactly as shown.**

```typescript
export function computeLaborCost(
  branchId: string,
  classificationLabel: string,
  selection: LaborSelection,
  mode: 'reg' | 'ot',
  ctx: { whatIf: WhatIf, branches: Branch[], employees: EmployeeRow[] },
) {
  const branch = ctx.branches.find(b => b.id === branchId);
  const cls = ctx.whatIf.classifications.find(
    c => c.label === classificationLabel
  );
  if (!branch || !cls) return null;

  const src = resolveWageSource(branchId, classificationLabel, selection,
                                 ctx.employees);

  const D = src.payPerHr;                          // Hourly Employee Wages
  const E = src.supp;                              // Supplemental Offset
  const F = mode === 'reg'
    ? (cls.reg_wage + cls.reg_supp)                // Certified total (reg)
    : (cls.ot_wage  + cls.ot_supp);                // Certified total (ot)
  const G = F - E;                                 // Net certified
  const H = mode === 'reg'
    ? Math.max(D, G)                               // Higher of employee/certified
    : Math.max(D * 1.5, F - E);                    // OT: 1.5x employee or certified
  const I = H * branch.wc_rate;                    // Workers' Comp
  const J = H * branch.pr_rate;                    // P/R Taxes
  const K = branch.medical_per_hr;                 // Medical (branch flat)
  const L = D * 0.10;                              // Vacation/Holiday accrual
  const M = branch.overhead_per_hr
           * ctx.whatIf.contrib_margin_pct;        // Overhead burden
  const STORM = mode === 'ot'
    ? (branch.storm_bonus_per_8h / 8)              // OT only, prorated to hr
    : 0;
  const TOTAL = H + I + J + K + L + M + STORM;

  return {
    wagesBase: D, supp: E, certifiedTotal: F, netCertified: G,
    wagesUsed: H, wc: I, payroll: J, medical: K, vacHol: L,
    overhead: M, storm: STORM, total: TOTAL,
    source: src.source, sourceLabel: src.label,
    employeeCount: src.count,
  };
}
```

**Source workbook equivalents (Labor sheet, row 8 = New Rochelle Foreman):**

```
REGULAR TIME (columns D–N):
D8  = VLOOKUP(B8, Employees!I:K, 2, FALSE)    // employee pay
E8  = VLOOKUP(B8, Employees!I:K, 3, FALSE)    // employee supp
F8  = 'What If Conditions'!F10                // certified total
G8  = F8 - E8
H8  = MAX(D8, G8)
I8  = H8 * I$7        // WC at branch rate
J8  = H8 * J$7        // P/R at branch rate
K8  = K$7             // medical (branch)
L8  = D8 * 0.1        // vac/hol
M8  = M$7 * 'What If Conditions'!F6  // overhead * contrib margin
N8  = SUM(H8:M8)

OVERTIME (columns S–AD):
S8  = D8 * 1.5
T8  = E8
U8  = 'What If Conditions'!K10
V8  = U8 - T8
W8  = MAX(S8, V8)
X8  = H8 * X$7        // WC on straight-time wages (NY convention)
Y8  = W8 * Y$7
Z8  = Z$7
AA8 = L8
AB8 = AB$7 / 8        // storm bonus prorated
AC8 = $M$8
AD8 = SUM(W8:AC8)
```

### 5.3 Crew totals

```typescript
// lib/formulas/crew.ts

type CrewSlot =
  | { kind: 'equipment'; equipmentId: string | null }
  | { kind: 'labor'; classification: string | null };

type Crew = {
  branchId: string;
  equipment: [CrewSlot, CrewSlot, CrewSlot];   // exactly 3 slots
  labor:     [CrewSlot, CrewSlot, CrewSlot, CrewSlot, CrewSlot]; // exactly 5
};

export function computeCrew(crew: Crew, mode: 'reg' | 'ot', ctx: Ctx) {
  const profitRate = ctx.whatIf.profit_pct;
  const emergMult  = ctx.whatIf.emergency_mult;
  const lines: CrewLine[] = [];

  for (const slot of crew.equipment) {
    if (!slot.equipmentId) { lines.push({ type: 'eq', empty: true }); continue; }
    const eq = ctx.equipment.find(e => e.id === slot.equipmentId);
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

  for (const slot of crew.labor) {
    if (!slot.classification) { lines.push({ type: 'lb', empty: true }); continue; }
    const selection = ctx.laborSelections[crew.branchId]?.[slot.classification]
                      ?? 'AVG';
    const lc = computeLaborCost(crew.branchId, slot.classification,
                                 selection, mode, ctx);
    lines.push({
      type: 'lb',
      label: slot.classification,
      sourceLabel: lc.sourceLabel,
      isPinned: lc.source === 'EMPLOYEE',
      costPerHr: lc.total,
      emergPerHr: lc.total * emergMult,
      profitPerHr: lc.total * profitRate,
      totalPerHr: lc.total * (1 + profitRate),
    });
  }

  const sum = (k: keyof CrewLine) =>
    lines.reduce((s, l) => s + (l.empty ? 0 : (l[k] as number)), 0);
  const totalCost   = sum('costPerHr');
  const totalProfit = sum('profitPerHr');
  const totalBill   = sum('totalPerHr');
  const totalEmerg  = sum('emergPerHr');

  // Rate of Return = (total billable for 8hr day) / (labor seats > $6/hr)
  const laborSeats = lines.filter(
    l => !l.empty && l.type === 'lb' && (l.totalPerHr ?? 0) >= 6
  ).length;
  const ror = laborSeats > 0 ? (totalBill * 8) / laborSeats : null;

  return {
    lines,
    totals: {
      costPerHr: totalCost,   costDay:   totalCost * 8,
      profitPerHr: totalProfit, profitDay: totalProfit * 8,
      billPerHr: totalBill,   billDay:   totalBill * 8,
      emergPerHr: totalEmerg, emergDay:  totalEmerg * 8,
      ror,
    },
  };
}
```

> **Note on Rate of Return:** the source workbook has a bug where the K-column total (emergency-rate total) only spans labor rows 1–3, missing rows 4–5. The web app must **FIX this bug** — sum all 5 labor slots correctly. Document this in code comments as an intentional improvement over the source.

### 5.4 Unit tests (required)

Every formula function gets a unit test file. Test cases must include:

- Equipment with zero fuel-gph, zero maintenance, zero licensing (should return 0)
- Equipment with `days_used = 0` (must not divide by zero)
- Labor: Foreman in New Rochelle with AVG selection, reg mode → matches workbook output for that branch/classification
- Labor: Foreman in New Rochelle pinned to a specific employee → matches when same employee is in B-column dropdown
- Labor: regular vs. overtime mode produces different results; overtime ≥ regular
- Labor: when employee wage exceeds certified wage, MAX picks employee wage
- Labor: when certified wage exceeds employee wage, MAX picks certified
- Crew: empty crew returns all zeros, no NaN, no divide-by-zero
- Crew: 3 equipment + 5 labor produces correct totals matching the workbook to within $0.01
- Rate of Return: returns `null` when zero labor seats above $6/hr; returns positive number otherwise

---

## 6. Supabase Schema

Below is the complete Postgres DDL. Implement via Supabase migrations (`supabase/migrations/0001_initial.sql`). Every table has RLS enabled with the policies described in Section 6.2.

### 6.1 Tables

```sql
-- Profiles (extends auth.users)
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  full_name       text,
  role            text not null check (role in ('sales', 'admin')) default 'sales',
  default_branch  uuid references public.branches(id),
  created_at      timestamptz not null default now()
);

-- Global assumptions (singleton: always row id = 1)
create table public.what_if (
  id                  int primary key default 1 check (id = 1),
  profit_pct          numeric(6,4)  not null default 0.2500,
  contrib_margin_pct  numeric(6,4)  not null default 1.0000,
  fuel_per_gal        numeric(8,4)  not null default 5.50,
  emergency_mult      numeric(6,4)  not null default 2.0000,
  updated_at          timestamptz   not null default now(),
  updated_by          uuid references public.profiles(id)
);

-- Labor classifications
create table public.classifications (
  id           uuid primary key default gen_random_uuid(),
  label        text not null unique,
  emp_class    text not null,        -- mapped to employee.classification
  reg_wage     numeric(10,4) not null default 0,
  reg_supp     numeric(10,4) not null default 0,
  ot_wage      numeric(10,4) not null default 0,
  ot_supp      numeric(10,4) not null default 0,
  description  text,
  sort_order   int not null default 0
);

-- Branches
create table public.branches (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  state                 text not null,
  display_label         text not null,
  wc_rate               numeric(8,5) not null,
  pr_rate               numeric(8,5) not null,
  medical_per_hr        numeric(10,4) not null default 0,
  overhead_per_hr       numeric(10,4) not null,
  storm_bonus_per_8h    numeric(10,2) not null default 0,
  sort_order            int not null default 0
);

-- Employees
create table public.employees (
  id                    uuid primary key default gen_random_uuid(),
  branch_id             uuid not null references public.branches(id) on delete restrict,
  emp_no                text not null,
  classification        text not null,    -- 'Foreman' | 'Climber' | ...
  last_name             text not null,
  first_name            text not null,
  pay_per_hr            numeric(10,4) not null,
  supplemental_per_hr   numeric(10,4) not null default 0,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (branch_id, emp_no)
);
create index on employees (branch_id, classification);

-- Equipment
create table public.equipment (
  id                    uuid primary key default gen_random_uuid(),
  truck_number          text not null unique,
  equipment_name        text not null,
  fuel_gph              numeric(8,4) not null default 0,
  annual_maint          numeric(12,2) not null default 0,
  annual_lic            numeric(12,2) not null default 0,
  days_used_per_year    int not null default 220,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on equipment (active);

-- Labor selections (per-branch pinned employees)
create table public.labor_selections (
  branch_id            uuid not null references public.branches(id) on delete cascade,
  classification_label text not null,
  -- 'AVG' = average; otherwise the employee uuid as text
  selection            text not null default 'AVG',
  updated_at           timestamptz not null default now(),
  updated_by           uuid references public.profiles(id),
  primary key (branch_id, classification_label)
);

-- Saved bids (named crew configurations)
create table public.bids (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null references public.profiles(id),
  branch_id     uuid not null references public.branches(id),
  name          text not null,
  client_name   text,
  notes         text,
  mode          text not null check (mode in ('reg', 'ot')),
  config        jsonb not null,    -- snapshot of equipment/labor selections
  snapshot      jsonb not null,    -- frozen calc result for audit
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on bids (created_by, created_at desc);
create index on bids (branch_id, created_at desc);

-- Audit log
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  action      text not null,         -- 'update_what_if', 'add_employee', etc.
  table_name  text,
  row_id      uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index on audit_log (created_at desc);
```

### 6.2 Row-Level Security policies

```sql
-- Enable RLS
alter table profiles          enable row level security;
alter table what_if           enable row level security;
alter table classifications   enable row level security;
alter table branches          enable row level security;
alter table employees         enable row level security;
alter table equipment         enable row level security;
alter table labor_selections  enable row level security;
alter table bids              enable row level security;
alter table audit_log         enable row level security;

-- Helper: check current user is admin
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Reference tables: any authenticated user reads; only admins write
create policy "read_what_if"  on what_if
  for select using (auth.role() = 'authenticated');
create policy "write_what_if" on what_if
  for all using (public.is_admin()) with check (public.is_admin());

-- Apply same read-any / write-admin pattern to:
-- classifications, branches, employees, equipment, labor_selections

-- Bids: users see and edit their own; admins see all
create policy "read_own_bids" on bids
  for select using (created_by = auth.uid() or public.is_admin());
create policy "insert_own_bids" on bids
  for insert with check (created_by = auth.uid());
create policy "update_own_bids" on bids
  for update using (created_by = auth.uid() or public.is_admin());
create policy "delete_own_bids" on bids
  for delete using (created_by = auth.uid() or public.is_admin());

-- Audit log: read by admins only, system-inserted
create policy "read_audit"   on audit_log
  for select using (public.is_admin());
```

### 6.3 Triggers

```sql
-- Update updated_at on row changes
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger trg_employees_updated  before update on employees
  for each row execute procedure public.set_updated_at();
create trigger trg_equipment_updated  before update on equipment
  for each row execute procedure public.set_updated_at();
create trigger trg_bids_updated       before update on bids
  for each row execute procedure public.set_updated_at();
create trigger trg_labor_sel_updated  before update on labor_selections
  for each row execute procedure public.set_updated_at();

-- Audit log triggers on reference data
create or replace function public.write_audit() returns trigger
language plpgsql security definer as $$
begin
  insert into public.audit_log (actor_id, action, table_name, row_id, before, after)
  values (
    auth.uid(),
    tg_op || '_' || tg_table_name,
    tg_table_name::text,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else row_to_json(old)::jsonb end,
    case when tg_op = 'DELETE' then null else row_to_json(new)::jsonb end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_what_if      after insert or update or delete on what_if
  for each row execute procedure public.write_audit();
create trigger trg_audit_branches     after insert or update or delete on branches
  for each row execute procedure public.write_audit();
create trigger trg_audit_employees    after insert or update or delete on employees
  for each row execute procedure public.write_audit();
create trigger trg_audit_equipment    after insert or update or delete on equipment
  for each row execute procedure public.write_audit();
create trigger trg_audit_classes      after insert or update or delete on classifications
  for each row execute procedure public.write_audit();
create trigger trg_audit_labor_sel    after insert or update or delete on labor_selections
  for each row execute procedure public.write_audit();
```

### 6.4 Realtime subscriptions

Enable realtime on the reference tables so changes propagate to all open browser sessions instantly. This matters because: an admin updates the fuel price → every sales user's open Crew Bid Sheet recalculates without refresh.

```sql
-- In Supabase dashboard or via SQL:
alter publication supabase_realtime add table what_if;
alter publication supabase_realtime add table classifications;
alter publication supabase_realtime add table branches;
alter publication supabase_realtime add table employees;
alter publication supabase_realtime add table equipment;
alter publication supabase_realtime add table labor_selections;
```

### 6.5 TypeScript generation

Generate types after every schema change:

```bash
supabase gen types typescript --project-id $PROJECT_ID --schema public \
  > types/db.ts
```

---

## 7. Screens & UX Requirements

### 7.1 Shell (app layout)

- **Header:** forest background, sticky on scroll. Almstead logo + wordmark left. "Product Costing" subtitle. View toggle on right: SALES VIEW (default, paper-pill) and ADMIN (yellow-pill, only available to users with `role=admin`).
- **Tabs below the header:** Crew Bid Sheet (Calculator icon), What If Conditions (Settings icon, admin-only), Labor (HardHat icon), Equipment (Wrench icon), Employees (Users icon). Active tab: paper fill, pine text, yellow bottom border.
- **Footer:** forest background, single line — "ALMSTEAD TREE, SHRUB & LAWN CARE · FOUNDED 1964" left; "Replaces the legacy product-costing workbook" right.

### 7.2 Crew Bid Sheet (landing page)

- Page title: "Build a Crew. Get a Bid." — 36px Spline Sans 700
- Subtitle: one line explaining what the page does
- "Reset crew" button top-right (ghost style)
- Row of branch pills (one per branch) with state code suffix; active pill = pine fill
- Reg-time / OT toggle pill group on the right — REGULAR TIME (emerald when active) / OVERTIME 1.5× (rust when active)
- Four metric cards in a 4-column grid: Hourly Cost, Profit @ 25%, Billable Hourly (highlighted, emerald fill, "QUOTE THIS" yellow badge), Emergency Rate (rust)
- Main bid table card: pine header showing the branch label, current mode, profit % and fuel/gallon
- Table rows: 3 equipment slots (each with a dropdown of all active equipment) + 5 labor slots (after a thin divider) each with a classification dropdown. Each labor slot also displays a small "using: 👤 EMPLOYEE" or "📊 Average Foreman" indicator under the dropdown when populated.
- Total row: pine fill, paper text, summed totals
- Rate of Return panel below: cream background, calculated value in DM Mono
- Save Bid button (primary, pine, top-right of the table) → opens a modal: name, optional client name, optional notes → saves to `bids` table
- Export PDF button (accent, ochre, top-right of the table when a bid is loaded) → `/api/export/[bidId]` returns a branded PDF

### 7.3 What If Conditions (admin only)

- Page title "What If Conditions" + subtitle
- Two side-by-side cards: "Pricing assumptions" (number inputs for profit %, contrib margin, fuel/gal, emergency multiplier) and "How these flow downstream" (butter background, bullet list explaining each value's downstream effect)
- Below: "Labor classifications & certified wages" card with an editable table: classification, reg wage, reg supp, ot wage, ot supp, description
- All inputs save on blur with a toast confirmation; an Amplitude event fires for each change
- Non-admin users see a centered "Admin only" placeholder card with a Settings icon and a "Switch to Admin mode" hint

### 7.4 Labor

- Branch pill selector at top (same as crew page)
- "Loading factors" card: branch-level WC rate, P/R tax rate, medical, overhead, storm bonus. Inputs editable only in Admin mode; readonly in Sales view (with an italic hint to switch to Admin).
- **"Wage source per classification" card** (butter background) — this is the critical UX. 5 cards in a row, one per classification. Each card has the classification label, the mapped employee class, and a dropdown showing:
  - `📊 Average [empClass] (count)` — listed first
  - `👤 LASTNAME, Firstname` — each employee in this branch matching the role
- When a non-AVG option is selected, the card gets a 2px ochre border + "PINNED" badge in the top-right; sub-text shows emp #, pay rate, supplemental
- "Reset all to Average" ghost button when at least one slot is pinned
- Below the picker: "Hourly cost build-up" table with pine header. Columns: Classification | Wage source (badge + label) | Wage Used | WC Ins. | P/R Tax | Medical | Vac/Hol | Overhead | REG TOTAL (butter) | OT TOTAL (butter, rust text)
- Bottom of page: cream note card reminding the user that pinning here flows into the Crew Bid Sheet
- Selections persist to `labor_selections` table; realtime sync to other browser sessions

### 7.5 Equipment

- Page title "Equipment Fleet"
- Search input (filter by truck # or name) + asset count + "Add equipment" accent button (admin only)
- Sticky-header table with rows: truck # (mono), equipment name, fuel gph, annual maint, annual lic, days/yr, Cost/Hr (butter, pine text bold), Day Cost (butter, bold), delete button (admin only)
- In Admin mode, every value cell becomes an inline input that saves on blur
- Add modal: truck #, equipment name, fuel gph, days used/yr, annual maintenance, annual licensing. "Save" requires truck # + name.
- Soft-delete pattern: set `active=false` rather than DELETE so historical bids preserve their snapshot

### 7.6 Employees

- Branch pill selector at top
- "Branch averages" card (cream background): 5-column grid of average pay + supp + headcount per classification (Foreman, Climber, Groundperson, Spray Tech, Lawn Tech). These are the actual numbers feeding the Crew Bid Sheet — make this prominent.
- Roster table below: emp #, classification (dropdown in admin), last name, first name, pay/hr, supp/hr, total (computed, pine), delete (admin)
- Add employee modal: emp #, classification (dropdown of valid classifications), last/first names, pay/hr, supp/hr
- Soft-delete via `active=false`

### 7.7 Saved bids index (optional)

- Accessible via a "My Bids" link in the header
- List of bids by the current user (admin sees all): name, client, branch, mode, total, created date
- Click row → load bid back into the Crew Bid Sheet, snapshot frozen at save time but editable
- Each row has Export PDF and Duplicate actions

---

## 8. Authentication & Roles

- Supabase Auth with email/password and magic links
- On first signup, a row is automatically created in `public.profiles` via a trigger on `auth.users` (role defaults to `'sales'`)
- Two roles: `sales` (default) and `admin`
- Admin role is assigned manually in Supabase dashboard during onboarding — there is no self-service role escalation
- View Toggle in the header: SALES VIEW (default) and ADMIN. Admin users can switch back to SALES VIEW to preview what their team sees.
- Tabs and editable fields gate on actual role (from JWT claims), not just the toggle state — the toggle is UI preference; backend enforcement is by RLS
- Login page: paper background, centered emerald "a" mark, "Almstead Costing" wordmark, email+password fields, magic-link option
- Session timeout: 8 hours of inactivity → re-auth required

### 8.1 First-time user trigger

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          'sales');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 9. Analytics Implementation

Two providers run in parallel. Google Analytics handles page-level traffic and conversion funnels (signups, bid saves, bid exports). Amplitude handles product-level event analysis: which features are used, by whom, how often, in what order.

### 9.1 Google Analytics 4

- Install via `@next/third-parties` (preferred over manual gtag)
- Track standard `page_view` automatically via App Router middleware
- Custom conversion events: `signup`, `bid_saved`, `bid_exported`
- Set `user_id` (Supabase `user.id`) on login so cross-device sessions stitch correctly
- UTM parameters preserved on signup link from internal communications

```typescript
// lib/analytics/ga.ts
import { sendGAEvent } from '@next/third-parties/google';

export function gaTrack(eventName: string,
                       params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  sendGAEvent({ event: eventName, ...params });
}

// app/layout.tsx — top-level
import { GoogleAnalytics } from '@next/third-parties/google';
<GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!} />
```

### 9.2 Amplitude — event taxonomy

Define every product event in a typed catalog. The agent should create `lib/analytics/events.ts` as the single source of truth — no string-typed events anywhere else.

| Event Name                | When it fires                                  | Properties                                                                                |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `app_loaded`              | Initial app mount after auth                   | `branch_count`, `equipment_count`, `employee_count`                                       |
| `tab_viewed`              | Tab change                                     | `tab_name`, `prior_tab`                                                                   |
| `view_mode_toggled`       | User switches Sales / Admin view               | `from`, `to`                                                                              |
| `branch_selected`         | Branch pill click                              | `branch_name`, `tab_name`                                                                 |
| `mode_toggled`            | Reg / OT toggle on crew sheet                  | `from`, `to`, `branch_name`                                                               |
| `equipment_slot_set`      | Equipment dropdown selection on crew sheet     | `slot_index`, `equipment_id`, `truck_number`, `branch_name`                               |
| `labor_slot_set`          | Labor classification dropdown on crew sheet    | `slot_index`, `classification`, `branch_name`                                             |
| `wage_source_pinned`      | Labor tab — user pins an employee              | `branch_name`, `classification`, `employee_id`                                            |
| `wage_source_reset`       | Labor tab — Reset all to Average clicked       | `branch_name`, `pinned_count_before`                                                      |
| `whatif_updated`          | Any What If Conditions field saved             | `field_name`, `prior_value`, `new_value`                                                  |
| `classification_updated`  | Certified wage edit                            | `classification`, `field_name`, `prior_value`, `new_value`                                |
| `branch_factor_updated`   | Branch loading factor edit                     | `branch_name`, `field_name`, `prior_value`, `new_value`                                   |
| `equipment_added`         | Add equipment modal submitted                  | `truck_number`, `name`                                                                    |
| `equipment_updated`       | Inline equipment edit                          | `equipment_id`, `field_name`                                                              |
| `equipment_removed`       | Soft-delete equipment                          | `equipment_id`, `truck_number`                                                            |
| `employee_added`          | Add employee modal submitted                   | `branch_name`, `classification`                                                           |
| `employee_updated`        | Inline employee edit                           | `employee_id`, `field_name`                                                               |
| `employee_removed`        | Soft-delete employee                           | `employee_id`, `branch_name`                                                              |
| `bid_saved`               | User saves a bid                               | `branch_name`, `mode`, `bill_per_hr`, `bill_per_day`, `crew_size`, `pinned_count`         |
| `bid_loaded`              | User opens a saved bid                         | `bid_id`, `branch_name`, `mode`                                                           |
| `bid_exported_pdf`        | PDF export completes                           | `bid_id`, `branch_name`                                                                   |
| `crew_reset`              | Reset crew button click                        | `branch_name`                                                                             |

```typescript
// lib/analytics/events.ts — typed catalog
import * as amplitude from '@amplitude/analytics-browser';

type EventMap = {
  app_loaded:            { branch_count: number; equipment_count: number;
                           employee_count: number };
  tab_viewed:            { tab_name: string; prior_tab: string | null };
  view_mode_toggled:     { from: 'sales' | 'admin'; to: 'sales' | 'admin' };
  branch_selected:       { branch_name: string; tab_name: string };
  mode_toggled:          { from: 'reg' | 'ot'; to: 'reg' | 'ot';
                           branch_name: string };
  equipment_slot_set:    { slot_index: number; equipment_id: string;
                           truck_number: string; branch_name: string };
  labor_slot_set:        { slot_index: number; classification: string;
                           branch_name: string };
  wage_source_pinned:    { branch_name: string; classification: string;
                           employee_id: string };
  wage_source_reset:     { branch_name: string; pinned_count_before: number };
  whatif_updated:        { field_name: string; prior_value: number;
                           new_value: number };
  bid_saved:             { branch_name: string; mode: 'reg' | 'ot';
                           bill_per_hr: number; bill_per_day: number;
                           crew_size: number; pinned_count: number };
  // ... etc
};

export function track<E extends keyof EventMap>(
  event: E, props: EventMap[E]
) {
  amplitude.track(event, props as Record<string, unknown>);
}

// app/_components/Analytics.tsx
'use client';
useEffect(() => {
  amplitude.init(process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY!, {
    defaultTracking: { pageViews: true, sessions: true,
                       attribution: true, formInteractions: false },
  });
}, []);

// On login, identify the user
amplitude.setUserId(user.id);
amplitude.identify(new amplitude.Identify()
  .set('role', profile.role)
  .set('branch', profile.default_branch_name));
```

### 9.3 Funnels worth pre-building

- **Activation:** `app_loaded` → `tab_viewed` (crews) → `equipment_slot_set` → `labor_slot_set` → `bid_saved`
- **Power-user adoption:** `wage_source_pinned` within 30 days of first login
- **Pricing knob usage:** `whatif_updated` by month, by user role
- **Export funnel:** `bid_saved` → `bid_exported_pdf` (which bids actually leave the building)

### 9.4 PII discipline

- **Do NOT send** employee names, emp numbers, or pay rates to either analytics provider
- Employee references use `employee_id` (UUID) only
- Customer / client names captured on bids are **NOT** sent to analytics — internal only
- Both providers receive `user_id` (Supabase UUID) — never email

---

## 10. Non-functional Requirements

### Performance

- Crew Bid Sheet recalculation: under 50ms from input change to UI update
- Initial page load (cold cache): under 2.5s on a 3G connection
- Realtime updates from Supabase: under 500ms propagation

### Accessibility

- WCAG 2.1 AA: color contrast verified for all green/cream combinations (the pine-on-paper is fine; verify cream-on-paper for muted text)
- All tables use proper `<th scope="col">` markup
- Keyboard navigation: every dropdown, button, and field reachable; focus rings always visible
- Screen-reader labels on all icon-only buttons

### Browser support

- Chrome, Safari, Firefox latest two versions; Edge latest
- iPad-friendly layout (responsive down to 1024px; below that, link to mobile workflow not in scope)

### Security

- All Supabase access via RLS — service role key never exposed to client
- PDF export endpoint validates current user owns the bid (or is admin)
- Rate-limit `/api/export` to 30 requests / hour / user
- No employee pay data in URL paths, query strings, or logs

### Observability

- Vercel Analytics for response times
- Supabase logs for query performance
- Sentry for client-side errors (configure source maps)

---

## 11. Acceptance Criteria

Verify each item before declaring the build complete. The agent should run through this checklist and report results.

### 11.1 Functional

- [ ] User can sign up, log in, and is created with `role=sales` by default
- [ ] Admin role correctly unlocks What If Conditions tab and all inline edit controls
- [ ] Crew Bid Sheet calculates correct totals for an empty crew (all zeros, no NaN)
- [ ] Crew Bid Sheet calculates correct totals for a known crew, verified against the source workbook to within $0.01
- [ ] Toggling REG / OT updates the labor lookup to use overtime certified rates
- [ ] Pinning an employee on the Labor tab flows into all Crew Bid Sheet rows for that branch + classification
- [ ] Reset all to Average restores AVG for all 5 classifications in the current branch
- [ ] Updating the global fuel price recalculates every equipment hourly cost on all open browser sessions within 1 second
- [ ] Bids save with both the config JSON and a frozen snapshot — loading a saved bid shows the rate AT THE TIME OF SAVE, not at current rates
- [ ] PDF export produces a branded one-page summary with logo, bid name, crew composition, and all totals
- [ ] Equipment soft-delete removes asset from dropdowns but historical bids still render correctly from their snapshots

### 11.2 Formula correctness

- [ ] Unit tests pass for every function in `lib/formulas/`
- [ ] For New Rochelle / Foreman / AVG / reg-time: REG TOTAL on Labor tab equals the source workbook value to within $0.01
- [ ] For every (branch, classification, mode) combination: REG TOTAL and OT TOTAL match workbook outputs
- [ ] Equipment hourly costs match workbook AA column for at least 10 sampled rows
- [ ] Rate of Return excludes labor lines below $6/hr (matches workbook intent) but correctly includes all 5 labor slots (fixing the workbook K-column sum bug)

### 11.3 Brand & UX

- [ ] Header reproduces the Almstead logo treatment exactly (rounded square + lowercase a + fern dot + wordmark)
- [ ] Spline Sans loaded; DM Mono used for all tabular numeric cells
- [ ] Green palette anchored on `#0E3A28` and `#0E7C3A` — no off-brand blues anywhere in the UI
- [ ] Pinned-employee state on Labor tab is visually distinct (ochre border + badge)
- [ ] "QUOTE THIS" yellow badge appears on the Billable Hourly metric card

### 11.4 Data integrity

- [ ] RLS prevents a sales user from updating any reference table
- [ ] Audit log captures every write to what_if, branches, employees, equipment, classifications
- [ ] Realtime subscriptions wired up for all reference tables

### 11.5 Analytics

- [ ] GA4 receives `page_view`, `signup`, `bid_saved`, `bid_exported`
- [ ] Amplitude receives every event in the Section 9.2 catalog with correct properties
- [ ] User identification works on both providers after login
- [ ] No employee names, emp numbers, or pay data sent to either provider

---

## 12. Appendix

### 12.1 Reference: source workbook formulas (read-only)

If the agent needs to verify any calculation against the source, here are the exact cell formulas from `Product_Costing_worksheets_2026_FINAL_BUILD_5-26-2026_003.xlsx`.

**New Rochelle Foreman regular-time, Labor sheet row 8:**

```
B8  = 'Average Foreman' (the wage source selection)
D8  = VLOOKUP(B8, Employees!$I$28:$J$70, 2, FALSE)
E8  = VLOOKUP(B8, Employees!$I$28:$K$70, 3, FALSE)
F8  = 'What If Conditions'!$F$10
G8  = F8 - E8
H8  = MAX(D8, G8)
I8  = H8 * I$7
J8  = H8 * J$7
K8  = K$7
L8  = D8 * 0.1
M8  = M7 * 'What If Conditions'!F6
N8  = SUM(H8:M8)
```

**Same row, overtime side:**

```
Q8  = B8
S8  = D8 * 1.5
T8  = E8
U8  = 'What If Conditions'!$K$10
V8  = U8 - T8
W8  = MAX(S8, V8)
X8  = H8 * X$7
Y8  = W8 * Y$7
Z8  = Z$7
AA8 = L8
AB8 = AB$7 / 8
AC8 = $M$8
AD8 = SUM(W8:AC8)
```

**Branch input row (row 7) — New Rochelle:**

```
A7 = 'New Rochelle:'
I7 = 0.0617    (WC Insurance rate)
J7 = 0.1226    (Payroll Taxes & Costs rate)
K7 = 0         (Medical $/hr)
M7 = 48.06     (Overhead Burden $/hr)
```

**Equipment sample row (Truck #40 Tractor):**

```
A8  = 40       (truck number)
B8  = 'Tractor'
O8  = 4.5      (fuel gph)
P8  = =P$2     (fuel cost/gal, pulled from What If Conditions)
Q8  = O8 * P8  (hourly fuel cost)
S8  = 21621.38 (annual maintenance)
T8  = 220      (days used per year)
U8  = S8 / (T8 * 8)  (hourly maintenance)
W8  = 1327.25  (annual licensing)
X8  = 220      (days used per year)
Y8  = W8 / (X8 * 8)  (hourly licensing)
AA8 = Q8 + U8 + Y8   (total hourly equipment cost)
AB8 = AA8 * 8        (8-hr day cost)
```

### 12.2 Glossary

- **Certified Wage** — NYS DOL prevailing wage for public-works classifications. Almstead must meet or exceed this rate on certified jobs.
- **Supplemental** — Non-wage portion of the prevailing wage package (benefits equivalent).
- **WC** — Workers' Compensation insurance premium, percentage of straight-time wages.
- **P/R Taxes** — Payroll taxes and related employer costs (FICA, FUTA, SUTA).
- **Overhead Burden** — Fixed-cost allocation per labor hour from the master budget.
- **Storm Bonus** — Premium per 8-hour shift for storm / emergency response work, OT mode only.
- **Contribution Margin** — Multiplier on overhead burden. Default 1.0.
- **Rate of Return** — Total 8-hour day rate divided by count of labor seats above $6/hr. A per-seat productivity diagnostic.
- **Pinned employee** — A specific named employee assigned to a labor slot, overriding the branch average.

---

*End of build specification.*
