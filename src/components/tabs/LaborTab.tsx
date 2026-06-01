'use client';

import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { computeLaborCost, EMP_CLASS_MAP } from '@/lib/formulas';
import { MapPin, Users, AlertCircle } from 'lucide-react';

const fmt$ = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n === 0) return '$0';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function LaborTab({ isAdmin }: { isAdmin: boolean }) {
  const activeBranch = useAppStore((s) => s.activeBranch);
  const setActiveBranch = useAppStore((s) => s.setActiveBranch);
  const branches = useAppStore((s) => s.branches);
  const classifications = useAppStore((s) => s.classifications);
  const employees = useAppStore((s) => s.employees);
  const whatIf = useAppStore((s) => s.whatIf);
  const laborSelections = useAppStore((s) => s.laborSelections);
  const setLaborSelection = useAppStore((s) => s.setLaborSelection);
  const resetLaborSelections = useAppStore((s) => s.resetLaborSelections);
  const setData = useAppStore((s) => s.setData);

  const branch = branches.find((b) => b.id === activeBranch);
  if (!branch || !whatIf) return null;

  const branchSel = laborSelections[activeBranch!] || {};
  const pinnedCount = Object.values(branchSel).filter((v) => v && v !== 'AVG').length;

  const updateBranch = async (field: string, value: number) => {
    const supabase = createClient();
    const updated = branches.map((b) =>
      b.id === activeBranch ? { ...b, [field]: value } : b
    );
    setData({ branches: updated });
    await supabase.from('branches').update({ [field]: value }).eq('id', activeBranch);
  };

  const updateSelection = async (classificationLabel: string, value: string) => {
    const supabase = createClient();
    setLaborSelection(activeBranch!, classificationLabel, value);
    await supabase.from('labor_selections').upsert({
      branch_id: activeBranch,
      classification_label: classificationLabel,
      selection: value,
    });
  };

  const handleResetAll = async () => {
    const supabase = createClient();
    resetLaborSelections(activeBranch!);
    for (const cls of classifications) {
      await supabase.from('labor_selections').upsert({
        branch_id: activeBranch,
        classification_label: cls.label,
        selection: 'AVG',
      });
    }
  };

  // Build options for each classification
  const buildOptions = (classificationLabel: string) => {
    const empClass = EMP_CLASS_MAP[classificationLabel] || classificationLabel;
    const matching = employees.filter((e) => e.branch_id === activeBranch && e.classification === empClass);
    return [
      { value: 'AVG', label: `Average ${empClass}`, isAverage: true, count: matching.length, sub: '' },
      ...matching.map((e) => ({
        value: e.id,
        label: `${e.last_name}, ${e.first_name}`,
        sub: `#${e.emp_no} · ${fmt$(e.pay_per_hr)}/hr + ${fmt$(e.supplemental_per_hr)} supp`,
        isAverage: false,
        count: 0,
      })),
    ];
  };

  // Compute labor cost for each classification
  const rows = classifications.map((cls) => {
    const selection = branchSel[cls.label] || 'AVG';
    const reg = computeLaborCost(activeBranch!, cls.label, selection, 'reg', {
      whatIf, classifications, branches, employees,
    });
    const ot = computeLaborCost(activeBranch!, cls.label, selection, 'ot', {
      whatIf, classifications, branches, employees,
    });
    return { cls, reg, ot };
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          Labor Cost Build-Up
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 15, marginTop: 6, maxWidth: 700 }}>
          Fully-loaded hourly cost by classification. Choose the branch average — or pin a specific named employee — to drive each row.
        </p>
      </div>

      {/* Branch pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {branches.map((b) => (
          <button key={b.id} className={`branch-pill ${activeBranch === b.id ? 'active' : ''}`}
            onClick={() => setActiveBranch(b.id)}>
            <MapPin size={12} /> {b.name} · {b.state}
          </button>
        ))}
      </div>

      {/* Loading factors */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-pine)', margin: '0 0 14px' }}>
          {branch.display_label} · Loading factors
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <LabeledField label="Workers' Comp Rate" value={branch.wc_rate} disabled={!isAdmin} onChange={(v) => updateBranch('wc_rate', v)} suffix="(decimal)" />
          <LabeledField label="P/R Taxes Rate" value={branch.pr_rate} disabled={!isAdmin} onChange={(v) => updateBranch('pr_rate', v)} suffix="(decimal)" />
          <LabeledField label="Medical / Hour" value={branch.medical_per_hr} disabled={!isAdmin} onChange={(v) => updateBranch('medical_per_hr', v)} prefix="$" />
          <LabeledField label="Overhead Burden / Hour" value={branch.overhead_per_hr} disabled={!isAdmin} onChange={(v) => updateBranch('overhead_per_hr', v)} prefix="$" />
          <LabeledField label="Storm Bonus / 8 Hrs" value={branch.storm_bonus_per_8h} disabled={!isAdmin} onChange={(v) => updateBranch('storm_bonus_per_8h', v)} prefix="$" />
        </div>
        {!isAdmin && (
          <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 12, fontStyle: 'italic' }}>
            <AlertCircle size={11} style={{ verticalAlign: 'middle' }} /> Switch to Admin mode to edit loading factors.
          </p>
        )}
      </div>

      {/* Wage source picker */}
      <div className="card" style={{ padding: 20, marginBottom: 20, background: 'var(--color-butter)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-pine)', margin: 0 }}>
              Wage source per classification
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '4px 0 0', maxWidth: 580 }}>
              For each row, pick the branch <strong>Average</strong> for that role, or a specific employee from the {branch.name} roster.
            </p>
          </div>
          {pinnedCount > 0 && (
            <button className="btn-ghost" onClick={handleResetAll}>
              <Users size={13} /> Reset all to Average
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {classifications.map((cls) => {
            const options = buildOptions(cls.label);
            const currentValue = branchSel[cls.label] || 'AVG';
            const isPinned = currentValue !== 'AVG';
            const currentOption = options.find((o) => o.value === currentValue);
            return (
              <div key={cls.id} style={{
                background: 'var(--color-paper)', borderRadius: 8, padding: 14,
                border: isPinned ? '2px solid var(--color-ochre)' : '1px solid var(--color-border)',
                position: 'relative',
              }}>
                {isPinned && (
                  <div style={{
                    position: 'absolute', top: -8, right: 10,
                    background: 'var(--color-ochre)', color: 'var(--color-paper)',
                    fontSize: 9, padding: '2px 8px', borderRadius: 999,
                    fontWeight: 700, letterSpacing: '0.08em',
                  }}>PINNED</div>
                )}
                <div style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {cls.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 2, marginBottom: 8 }}>
                  → {EMP_CLASS_MAP[cls.label] || cls.label}
                </div>
                <select className="select-field" value={currentValue}
                  onChange={(e) => updateSelection(cls.label, e.target.value)}
                  style={{ fontSize: 12 }}>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.isAverage ? `📊 ${o.label}${o.count > 0 ? ` (${o.count})` : ''}` : `👤 ${o.label}`}
                    </option>
                  ))}
                </select>
                {currentOption && !currentOption.isAverage && 'sub' in currentOption && (
                  <div className="mono" style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 6 }}>
                    {currentOption.sub}
                  </div>
                )}
                {currentOption && currentOption.isAverage && options.length > 1 && (
                  <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 6 }}>
                    Avg of {options.length - 1} on roster
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost build-up table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'var(--color-pine)', color: 'var(--color-paper)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-paper)', margin: 0 }}>
            Hourly cost build-up
          </h2>
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
                <th className="num" style={{ background: 'var(--color-butter)' }}>REG TOTAL</th>
                <th className="num" style={{ background: 'var(--color-butter)' }}>OT TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cls.id}>
                  <td style={{ fontWeight: 600 }}>{r.cls.label}</td>
                  <td>
                    {r.reg && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600,
                          letterSpacing: '0.05em',
                          background: r.reg.source === 'EMPLOYEE' ? 'rgba(184, 138, 42, 0.12)' : 'rgba(184, 217, 168, 0.4)',
                          color: r.reg.source === 'EMPLOYEE' ? 'var(--color-ochre)' : 'var(--color-pine)',
                        }}>
                          {r.reg.source === 'EMPLOYEE' ? 'PINNED' : 'AVG'}
                        </span>
                        <span style={{ fontSize: 12 }}>{r.reg.sourceLabel}</span>
                      </div>
                    )}
                  </td>
                  <td className="num mono">{r.reg ? fmt$(r.reg.wagesUsed) : '—'}</td>
                  <td className="num mono">{r.reg ? fmt$(r.reg.wc) : '—'}</td>
                  <td className="num mono">{r.reg ? fmt$(r.reg.payroll) : '—'}</td>
                  <td className="num mono">{r.reg ? fmt$(r.reg.medical) : '—'}</td>
                  <td className="num mono">{r.reg ? fmt$(r.reg.vacHol) : '—'}</td>
                  <td className="num mono">{r.reg ? fmt$(r.reg.overhead) : '—'}</td>
                  <td className="num mono" style={{ background: 'var(--color-butter)', fontWeight: 700, color: 'var(--color-pine)' }}>
                    {r.reg ? fmt$(r.reg.total) : '—'}
                  </td>
                  <td className="num mono" style={{ background: 'var(--color-butter)', fontWeight: 700, color: 'var(--color-rust)' }}>
                    {r.ot ? fmt$(r.ot.total) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-cream)', borderRadius: 6, fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--color-ink)' }}>Note:</strong> selections here flow into the Crew Bid Sheet automatically.
        Pinning an employee as the Foreman on the {branch.name} labor row means his rate is what the bid sheet uses for any Foreman slot in that branch&apos;s crew.
      </div>
    </div>
  );
}

function LabeledField({ label, value, onChange, prefix, suffix, disabled }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
        {label} {suffix && <span style={{ fontWeight: 400, textTransform: 'none' }}>{suffix}</span>}
      </label>
      <div style={{ position: 'relative' }}>
        {prefix && <span className="mono" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', fontSize: 13 }}>{prefix}</span>}
        <input className="input-field num" type="number" step="0.0001"
          value={value} disabled={disabled}
          style={{ paddingLeft: prefix ? 24 : 10, textAlign: 'right' }}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
      </div>
    </div>
  );
}
