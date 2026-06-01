'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { computeEquipmentCost } from '@/lib/formulas';
import { Plus, Trash2, Save, Search } from 'lucide-react';

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt$0 = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function EquipmentTab({ isAdmin }: { isAdmin: boolean }) {
  const equipment = useAppStore((s) => s.equipment);
  const whatIf = useAppStore((s) => s.whatIf);
  const setData = useAppStore((s) => s.setData);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  if (!whatIf) return null;

  const filtered = equipment.filter((eq) =>
    !search ||
    eq.truck_number.includes(search) ||
    eq.equipment_name.toLowerCase().includes(search.toLowerCase())
  );

  const updateEq = async (id: string, field: string, value: string | number) => {
    const supabase = createClient();
    const numFields = ['fuel_gph', 'annual_maint', 'annual_lic', 'days_used_per_year'];
    const finalVal = numFields.includes(field) ? (parseFloat(String(value)) || 0) : value;
    const updated = equipment.map((e) => e.id === id ? { ...e, [field]: finalVal } : e);
    setData({ equipment: updated });
    await supabase.from('equipment').update({ [field]: finalVal }).eq('id', id);
  };

  const deleteEq = async (id: string) => {
    if (!confirm('Remove this equipment from the fleet?')) return;
    const supabase = createClient();
    const updated = equipment.filter((e) => e.id !== id);
    setData({ equipment: updated });
    await supabase.from('equipment').update({ active: false }).eq('id', id);
  };

  const addEq = async (eq: { truck_number: string; equipment_name: string; fuel_gph: number; annual_maint: number; annual_lic: number; days_used_per_year: number }) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('equipment').insert(eq).select().single();
    if (data && !error) {
      setData({
        equipment: [...equipment, { ...data, fuel_gph: Number(data.fuel_gph), annual_maint: Number(data.annual_maint), annual_lic: Number(data.annual_lic), days_used_per_year: Number(data.days_used_per_year) }],
      });
    }
    setShowAdd(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          Equipment Fleet
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 15, marginTop: 6, maxWidth: 700 }}>
          Per-asset hourly cost build-up — fuel, maintenance, licensing. The crew bid sheet pulls from this list.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input type="text" placeholder="Search by truck # or name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-field" style={{ paddingLeft: 30, fontFamily: 'var(--font-sans)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{filtered.length} of {equipment.length} assets</span>
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
                <th className="num" style={{ background: 'var(--color-butter)' }}>Cost / Hr</th>
                <th className="num" style={{ background: 'var(--color-butter)' }}>Day Cost</th>
                {isAdmin && <th style={{ width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((eq) => {
                const calc = computeEquipmentCost(eq, whatIf.fuel_per_gal);
                return (
                  <tr key={eq.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>#{eq.truck_number}</td>
                    <td>
                      {isAdmin
                        ? <input className="input-field" value={eq.equipment_name}
                            onChange={(e) => updateEq(eq.id, 'equipment_name', e.target.value)} />
                        : eq.equipment_name}
                    </td>
                    <td className="num">
                      {isAdmin
                        ? <input className="input-field num" type="number" step="0.1"
                            value={eq.fuel_gph} onChange={(e) => updateEq(eq.id, 'fuel_gph', e.target.value)} />
                        : eq.fuel_gph.toFixed(1)}
                    </td>
                    <td className="num">
                      {isAdmin
                        ? <input className="input-field num" type="number" step="1"
                            value={eq.annual_maint} onChange={(e) => updateEq(eq.id, 'annual_maint', e.target.value)} />
                        : fmt$0(eq.annual_maint)}
                    </td>
                    <td className="num">
                      {isAdmin
                        ? <input className="input-field num" type="number" step="1"
                            value={eq.annual_lic} onChange={(e) => updateEq(eq.id, 'annual_lic', e.target.value)} />
                        : fmt$0(eq.annual_lic)}
                    </td>
                    <td className="num">
                      {isAdmin
                        ? <input className="input-field num" type="number" step="1"
                            value={eq.days_used_per_year} onChange={(e) => updateEq(eq.id, 'days_used_per_year', e.target.value)} />
                        : eq.days_used_per_year}
                    </td>
                    <td className="num mono" style={{ background: 'var(--color-butter)', fontWeight: 700, color: 'var(--color-pine)' }}>
                      {fmt$(calc.totalPerHr)}
                    </td>
                    <td className="num mono" style={{ background: 'var(--color-butter)', fontWeight: 600 }}>
                      {fmt$0(calc.totalPerDay)}
                    </td>
                    {isAdmin && (
                      <td>
                        <button className="btn-danger" onClick={() => deleteEq(eq.id)} title="Remove">
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

function AddEquipmentModal({ onAdd, onClose }: {
  onAdd: (eq: { truck_number: string; equipment_name: string; fuel_gph: number; annual_maint: number; annual_lic: number; days_used_per_year: number }) => void;
  onClose: () => void;
}) {
  const [eq, setEq] = useState({ truck_number: '', equipment_name: '', fuel_gph: 0, annual_maint: 0, annual_lic: 0, days_used_per_year: 220 });
  const upd = (k: string, v: string | number) => setEq((prev) => ({ ...prev, [k]: k === 'truck_number' || k === 'equipment_name' ? v : (parseFloat(String(v)) || 0) }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-content" style={{ padding: 28, width: 480, background: 'var(--color-paper)' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 16px' }}>Add equipment</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Truck #</label>
            <input className="input-field" value={eq.truck_number} onChange={(e) => upd('truck_number', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Equipment name</label>
            <input className="input-field" value={eq.equipment_name} onChange={(e) => upd('equipment_name', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Fuel gph</label>
            <input className="input-field num" type="number" step="0.1" value={eq.fuel_gph} onChange={(e) => upd('fuel_gph', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Days used / yr</label>
            <input className="input-field num" type="number" value={eq.days_used_per_year} onChange={(e) => upd('days_used_per_year', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Annual Maintenance</label>
            <input className="input-field num" type="number" step="1" value={eq.annual_maint} onChange={(e) => upd('annual_maint', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Annual Licensing</label>
            <input className="input-field num" type="number" step="1" value={eq.annual_lic} onChange={(e) => upd('annual_lic', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onAdd(eq)} disabled={!eq.truck_number || !eq.equipment_name}>
            <Save size={14} /> Add to fleet
          </button>
        </div>
      </div>
    </div>
  );
}
