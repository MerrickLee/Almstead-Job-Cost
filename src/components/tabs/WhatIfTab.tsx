'use client';

import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { Settings } from 'lucide-react';

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WhatIfTab({ isAdmin }: { isAdmin: boolean }) {
  const whatIf = useAppStore((s) => s.whatIf);
  const classifications = useAppStore((s) => s.classifications);
  const setData = useAppStore((s) => s.setData);

  if (!isAdmin) {
    return (
      <div style={{
        padding: 60, textAlign: 'center',
        background: 'var(--color-cream)', borderRadius: 12,
        border: '1px dashed var(--color-border-dk)', maxWidth: 600, margin: '60px auto',
      }}>
        <Settings size={48} color="var(--color-muted)" style={{ margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-ink)' }}>
          What If Conditions — Admin only
        </h2>
        <p style={{ color: 'var(--color-muted)', fontSize: 14, margin: '0 0 20px' }}>
          Global assumptions live here. Switch to <strong>Admin</strong> mode in the header to view and edit.
        </p>
      </div>
    );
  }

  if (!whatIf) return null;

  const updateWhatIf = async (field: string, value: number) => {
    const supabase = createClient();
    setData({
      whatIf: { ...whatIf, [field]: value },
    });
    await supabase.from('what_if').update({ [field]: value }).eq('id', 1);
  };

  const updateClassification = async (id: string, field: string, value: number | string) => {
    const supabase = createClient();
    const updated = classifications.map((c) =>
      c.id === id ? { ...c, [field]: value } : c
    );
    setData({ classifications: updated });
    await supabase.from('classifications').update({ [field]: value }).eq('id', id);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, margin: 0, color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>
          What If Conditions
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 15, marginTop: 6, maxWidth: 700 }}>
          Global assumptions. Changes here ripple through every branch&apos;s labor build-up and crew bid.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Pricing assumptions */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-pine)', margin: '0 0 14px' }}>
            Pricing assumptions
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <NumField label="Profit Percentage" value={whatIf.profit_pct} onChange={(v) => updateWhatIf('profit_pct', v)} suffix="(decimal)" />
            <NumField label="Contribution Margin %" value={whatIf.contrib_margin_pct} onChange={(v) => updateWhatIf('contrib_margin_pct', v)} suffix="(decimal)" />
            <NumField label="Fuel Cost / Gallon" value={whatIf.fuel_per_gal} onChange={(v) => updateWhatIf('fuel_per_gal', v)} prefix="$" />
            <NumField label="Emergency Multiplier" value={whatIf.emergency_mult} onChange={(v) => updateWhatIf('emergency_mult', v)} suffix="×" />
          </div>
        </div>

        {/* How these flow */}
        <div className="card" style={{ padding: 24, background: 'var(--color-butter)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-pine)', margin: '0 0 14px' }}>
            How these flow downstream
          </h2>
          <ul style={{ fontSize: 13, color: 'var(--color-ink)', paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
            <li><strong>Profit %</strong> — multiplied by each line&apos;s cost to compute profit dollars and billable rate.</li>
            <li><strong>Contribution Margin %</strong> — multiplier on each branch&apos;s overhead burden on the Labor tab.</li>
            <li><strong>Fuel / gallon</strong> — drives every piece of equipment&apos;s hourly fuel cost.</li>
            <li><strong>Emergency multiplier</strong> — applied to costs on the crew sheet for storm/after-hours quoting.</li>
          </ul>
        </div>
      </div>

      {/* Classifications table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'var(--color-cream)', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-pine)', margin: 0 }}>
            Labor classifications & certified wages
          </h2>
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
            {classifications.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.label}</td>
                <td>
                  <input className="input-field num" type="number" step="0.01"
                    value={c.reg_wage}
                    onChange={(e) => updateClassification(c.id, 'reg_wage', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input className="input-field num" type="number" step="0.01"
                    value={c.reg_supp}
                    onChange={(e) => updateClassification(c.id, 'reg_supp', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input className="input-field num" type="number" step="0.01"
                    value={c.ot_wage}
                    onChange={(e) => updateClassification(c.id, 'ot_wage', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input className="input-field num" type="number" step="0.01"
                    value={c.ot_supp}
                    onChange={(e) => updateClassification(c.id, 'ot_supp', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input className="input-field" type="text"
                    value={c.description || ''}
                    onChange={(e) => updateClassification(c.id, 'description', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, prefix, suffix }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
        {label} {suffix && <span style={{ fontWeight: 400, textTransform: 'none' }}>{suffix}</span>}
      </label>
      <div style={{ position: 'relative' }}>
        {prefix && <span className="mono" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', fontSize: 13 }}>{prefix}</span>}
        <input
          className="input-field num"
          type="number" step="0.0001"
          value={value}
          style={{ paddingLeft: prefix ? 24 : 10, textAlign: 'right' }}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}
