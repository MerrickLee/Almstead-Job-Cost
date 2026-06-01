// =============================================================================
// Equipment Cost Calculation
// Verified against source workbook Equipment sheet.
// =============================================================================

import { EquipmentRow, EquipmentCostResult } from './types';

/**
 * Compute the hourly and daily cost for a piece of equipment.
 *
 * Source workbook equivalents (Equipment sheet):
 *   Q8  = O8 * P8                  // fuel_gph * fuel_per_gal
 *   U8  = S8 / (T8 * 8)            // annual_maint / (days * 8)
 *   Y8  = W8 / (X8 * 8)            // annual_lic / (days * 8)
 *   AA8 = Q8 + U8 + Y8             // hourly total
 *   AB8 = AA8 * 8                   // 8-hr day total
 */
export function computeEquipmentCost(
  eq: EquipmentRow,
  fuelPerGal: number
): EquipmentCostResult {
  const fuelCost = eq.fuel_gph * fuelPerGal;
  const maintHr = eq.days_used_per_year > 0
    ? eq.annual_maint / (eq.days_used_per_year * 8)
    : 0;
  const licHr = eq.days_used_per_year > 0
    ? eq.annual_lic / (eq.days_used_per_year * 8)
    : 0;
  const totalPerHr = fuelCost + maintHr + licHr;
  const totalPerDay = totalPerHr * 8;
  return { fuelCost, maintHr, licHr, totalPerHr, totalPerDay };
}
