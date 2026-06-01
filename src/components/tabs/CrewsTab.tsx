'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { computeCrew } from '@/lib/formulas';
import {
  MapPin,
  Clock,
  TrendingUp,
  Trash2,
} from 'lucide-react';

// Formatting helpers
const fmt$ = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n === 0) return '$0';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmt$0 = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtPct = (n: number) => (n * 100).toFixed(2) + '%';

export default function CrewsTab({ isAdmin }: { isAdmin: boolean }) {
  const activeBranch = useAppStore((s) => s.activeBranch);
  const setActiveBranch = useAppStore((s) => s.setActiveBranch);
  const otMode = useAppStore((s) => s.otMode);
  const setOtMode = useAppStore((s) => s.setOtMode);
  const branches = useAppStore((s) => s.branches);
  const crews = useAppStore((s) => s.crews);
  const updateEquipSlot = useAppStore((s) => s.updateEquipSlot);
  const updateLaborSlot = useAppStore((s) => s.updateLaborSlot);
  const resetCrew = useAppStore((s) => s.resetCrew);
  const getFormulaContext = useAppStore((s) => s.getFormulaContext);
  const equipment = useAppStore((s) => s.equipment);
  const classifications = useAppStore((s) => s.classifications);

  const ctx = getFormulaContext();
  const branch = branches.find((b) => b.id === activeBranch);
  const crew = activeBranch ? crews[activeBranch] : null;

  const result = useMemo(() => {
    if (!ctx || !crew) return null;
    return computeCrew(crew, otMode ? 'ot' : 'reg', ctx);
  }, [ctx, crew, otMode]);

  if (!branch || !crew || !result || !ctx) return null;

  return (
    <div>
      {/* PAGE INTRO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontSize: 36, fontWeight: 700,
            margin: 0, color: 'var(--color-ink)', letterSpacing: '-0.02em',
          }}>Build a Crew. Get a Bid.</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 15, marginTop: 6, maxWidth: 580 }}>
            Pick equipment and labor classifications. Costs, profit, and the billable rate update live.
            Toggle between regular time and overtime to compare pricing scenarios.
          </p>
        </div>
        <button className="btn-ghost" onClick={() => resetCrew(activeBranch!)}>
          <Trash2 size={13} /> Reset crew
        </button>
      </div>

      {/* BRANCH PILLS + OT TOGGLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {branches.map((b) => (
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
          display: 'inline-flex', background: 'var(--color-cream)',
          borderRadius: 999, padding: 4,
          border: '1px solid var(--color-border)',
        }}>
          <button
            onClick={() => setOtMode(false)}
            style={{
              padding: '6px 16px', borderRadius: 999, border: 'none',
              background: !otMode ? 'var(--color-emerald)' : 'transparent',
              color: !otMode ? 'var(--color-paper)' : 'var(--color-ink)',
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.15s',
            }}
          ><Clock size={12} />REGULAR TIME</button>
          <button
            onClick={() => setOtMode(true)}
            style={{
              padding: '6px 16px', borderRadius: 999, border: 'none',
              background: otMode ? 'var(--color-rust)' : 'transparent',
              color: otMode ? 'var(--color-paper)' : 'var(--color-ink)',
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.15s',
            }}
          ><TrendingUp size={12} />OVERTIME (1.5×)</button>
        </div>
      </div>

      {/* HEADLINE METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard label="Hourly Cost" value={fmt$(result.totals.costPerHr)} sub={fmt$0(result.totals.costDay) + ' / 8-hr day'} color="var(--color-pine)" />
        <MetricCard label="Profit @ 25%" value={fmt$(result.totals.profitPerHr)} sub={fmt$0(result.totals.profitDay) + ' / 8-hr day'} color="var(--color-ochre)" />
        <MetricCard label="Billable Hourly" value={fmt$(result.totals.billPerHr)} sub={fmt$0(result.totals.billDay) + ' / 8-hr day'} color="var(--color-emerald)" highlight />
        <MetricCard label="Emergency Rate" value={fmt$(result.totals.emergPerHr)} sub={`@ ${ctx.whatIf.emergency_mult}× cost mult.`} color="var(--color-rust)" />
      </div>

      {/* MAIN BID TABLE */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          background: 'var(--color-pine)', color: 'var(--color-paper)',
          padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-fern)', letterSpacing: '0.08em', fontWeight: 500 }}>
              {branch.display_label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              Crew Configuration · {otMode ? 'Overtime' : 'Regular Time'}
            </div>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--color-fern)' }}>
            Profit {fmtPct(ctx.whatIf.profit_pct)} · Fuel ${ctx.whatIf.fuel_per_gal.toFixed(2)}/gal
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
                  <td style={{ color: 'var(--color-muted)', fontWeight: 500 }}>
                    <span className="badge" style={{ background: 'var(--color-fern)', color: 'var(--color-pine)' }}>EQ {i + 1}</span>
                  </td>
                  <td>
                    <select
                      className="select-field"
                      value={e.equipmentId || ''}
                      onChange={(ev) => updateEquipSlot(activeBranch!, i, ev.target.value || null)}
                    >
                      <option value="">— Select equipment —</option>
                      {equipment.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          #{eq.truck_number} {eq.equipment_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num mono">{line && !line.empty ? fmt$(line.costPerHr!) : '—'}</td>
                  <td className="num mono">{line && !line.empty ? fmt$(line.emergPerHr!) : '—'}</td>
                  <td className="num mono">{line && !line.empty ? fmt$(line.profitPerHr!) : '—'}</td>
                  <td className="num mono" style={{ fontWeight: 600 }}>{line && !line.empty ? fmt$(line.totalPerHr!) : '—'}</td>
                  <td className="num mono">{line && !line.empty ? fmt$0(line.totalPerHr! * 8) : '—'}</td>
                </tr>
              );
            })}

            {/* DIVIDER */}
            <tr><td colSpan={7} style={{ padding: 0, height: 1, background: 'var(--color-border-dk)', border: 'none' }}></td></tr>

            {/* LABOR ROWS */}
            {crew.labor.map((l, i) => {
              const line = result.lines[i + 3];
              return (
                <tr key={'lb' + i}>
                  <td style={{ color: 'var(--color-muted)', fontWeight: 500 }}>
                    <span className="badge" style={{ background: 'var(--color-butter)', color: 'var(--color-ochre)' }}>LB {i + 1}</span>
                  </td>
                  <td>
                    <select
                      className="select-field"
                      value={l.classification || ''}
                      onChange={(ev) => updateLaborSlot(activeBranch!, i, ev.target.value || null)}
                    >
                      <option value="">— Select classification —</option>
                      {classifications.map((c) => (
                        <option key={c.id} value={c.label}>{c.label}</option>
                      ))}
                    </select>
                    {line && !line.empty && line.sourceLabel && (
                      <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {line.isPinned ? (
                          <span style={{ color: 'var(--color-ochre)', fontWeight: 600 }}>👤 {line.sourceLabel}</span>
                        ) : (
                          <span>📊 {line.sourceLabel}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="num mono">{line && !line.empty ? fmt$(line.costPerHr!) : '—'}</td>
                  <td className="num mono">{line && !line.empty ? fmt$(line.emergPerHr!) : '—'}</td>
                  <td className="num mono">{line && !line.empty ? fmt$(line.profitPerHr!) : '—'}</td>
                  <td className="num mono" style={{ fontWeight: 600 }}>{line && !line.empty ? fmt$(line.totalPerHr!) : '—'}</td>
                  <td className="num mono">{line && !line.empty ? fmt$0(line.totalPerHr! * 8) : '—'}</td>
                </tr>
              );
            })}

            {/* TOTAL ROW */}
            <tr className="total-row">
              <td colSpan={2} style={{ fontSize: 13, letterSpacing: '0.05em' }}>CREW TOTAL</td>
              <td className="num mono">{fmt$(result.totals.costPerHr)}</td>
              <td className="num mono">{fmt$(result.totals.emergPerHr)}</td>
              <td className="num mono">{fmt$(result.totals.profitPerHr)}</td>
              <td className="num mono" style={{ fontSize: 15 }}>{fmt$(result.totals.billPerHr)}</td>
              <td className="num mono" style={{ fontSize: 15 }}>{fmt$0(result.totals.billDay)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* RATE OF RETURN */}
      {result.totals.ror !== null && (
        <div style={{
          marginTop: 16, padding: '14px 20px',
          background: 'var(--color-cream)', borderRadius: 8,
          border: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', letterSpacing: '0.08em', fontWeight: 500 }}>
              RATE OF RETURN (PER LABOR SEAT, 8-HR DAY)
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-pine)' }}>
              {fmt$(result.totals.ror)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', maxWidth: 380, textAlign: 'right' }}>
            Total 8-hr billable divided by count of labor seats priced above $6/hr.
            A productivity sanity check.
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Metric Card
// =============================================================================

function MetricCard({
  label,
  value,
  sub,
  color,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      padding: '18px 20px',
      background: highlight ? color : 'var(--color-paper)',
      color: highlight ? 'var(--color-paper)' : 'var(--color-ink)',
      borderRadius: 8,
      border: highlight ? 'none' : '1px solid var(--color-border)',
      position: 'relative',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}>
      {highlight && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: 'var(--color-yellow)', color: 'var(--color-forest)',
          fontSize: 9, padding: '2px 8px', borderRadius: 999,
          fontWeight: 700, letterSpacing: '0.08em',
        }}>QUOTE THIS</div>
      )}
      <div style={{
        fontSize: 10, letterSpacing: '0.1em', fontWeight: 600,
        color: highlight ? 'var(--color-fern)' : 'var(--color-muted)', textTransform: 'uppercase',
      }}>{label}</div>
      <div className="mono" style={{
        fontSize: 28, fontWeight: 700,
        marginTop: 6, letterSpacing: '-0.02em',
        color: highlight ? 'var(--color-paper)' : color,
      }}>{value}</div>
      <div style={{
        fontSize: 11, color: highlight ? 'var(--color-fern)' : 'var(--color-muted)',
        marginTop: 4,
      }}>{sub}</div>
    </div>
  );
}
