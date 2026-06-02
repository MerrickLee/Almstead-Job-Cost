'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Plus, Trash2, Save } from 'lucide-react';

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export default function EmployeesTab({ isAdmin }: { isAdmin: boolean }) {
  const activeBranch = useAppStore((s) => s.activeBranch);
  const setActiveBranch = useAppStore((s) => s.setActiveBranch);
  const branches = useAppStore((s) => s.branches);
  const employees = useAppStore((s) => s.employees);
  const setData = useAppStore((s) => s.setData);
  const [showAdd, setShowAdd] = useState(false);

  const branch = branches.find((b) => b.id === activeBranch);
  if (!branch) return null;

  const branchEmployees = employees.filter((e) => e.branch_id === activeBranch);

  // Branch averages
  const classificationLabels = ['Foreman', 'Climber', 'Groundperson', 'Spray Tech', 'Lawn Tech'];
  const averages = classificationLabels.map((cls) => {
    const matching = branchEmployees.filter((e) => e.classification === cls);
    if (matching.length === 0) return { label: cls, payPerHr: null, supp: null, count: 0 };
    return {
      label: cls,
      payPerHr: mean(matching.map((e) => e.pay_per_hr)),
      supp: mean(matching.map((e) => e.supplemental_per_hr)),
      count: matching.length,
    };
  });

  const updateEmployee = async (id: string, field: string, value: string | number) => {
    const supabase = createClient();
    const numFields = ['pay_per_hr', 'supplemental_per_hr'];
    const finalVal = numFields.includes(field) ? (parseFloat(String(value)) || 0) : value;
    const updated = employees.map((e) => e.id === id ? { ...e, [field]: finalVal } : e);
    setData({ employees: updated });
    await supabase.from('employees').update({ [field]: finalVal }).eq('id', id);
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Remove this employee?')) return;
    const supabase = createClient();
    const updated = employees.filter((e) => e.id !== id);
    setData({ employees: updated });
    await supabase.from('employees').update({ active: false }).eq('id', id);
  };

  const addEmployee = async (emp: { emp_no: string; classification: string; last_name: string; first_name: string; pay_per_hr: number; supplemental_per_hr: number }) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('employees').insert({
      ...emp,
      branch_id: activeBranch,
    }).select().single();
    if (data && !error) {
      setData({
        employees: [...employees, { ...data, pay_per_hr: Number(data.pay_per_hr), supplemental_per_hr: Number(data.supplemental_per_hr) }],
      });
    }
    setShowAdd(false);
  };

  const empClassifications = ['Foreman', 'Climber', 'Groundperson', 'Spray Tech', 'Lawn Tech', 'Operations Manager', 'Nursery- Field', 'Nursery- Mulch Yard', 'Nursery- Driver'];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          Employee Roster
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 15, marginTop: 6, maxWidth: 700 }}>
          Branch averages by classification drive the labor cost build-up. Edit individuals here; the crew bid sheet recalculates automatically.
        </p>
      </div>

      {/* Branch pills with headcount */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {branches.map((b) => (
          <button key={b.id} className={`branch-pill ${activeBranch === b.id ? 'active' : ''}`}
            onClick={() => setActiveBranch(b.id)}>
            <MapPin size={12} /> {b.name} · {employees.filter((e) => e.branch_id === b.id).length}
          </button>
        ))}
      </div>

      {/* Branch averages */}
      <div className="card" style={{ padding: 20, marginBottom: 20, background: 'var(--color-cream)' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-pine)', margin: '0 0 14px' }}>
          Branch averages · {branch.name}
        </h2>
        <div className="averages-grid">
          {averages.map((a) => (
            <div key={a.label} style={{
              padding: 14, background: 'var(--color-paper)',
              borderRadius: 6, border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                {a.label}
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-pine)', marginTop: 4 }}>
                {a.payPerHr !== null ? fmt$(a.payPerHr) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                + {a.supp !== null ? fmt$(a.supp) : '—'} supp · {a.count > 0 ? `${a.count} ppl` : 'no data'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roster table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-pine)', margin: 0 }}>
          Roster ({branchEmployees.length})
        </h2>
        {isAdmin && (
          <button className="btn-accent" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add employee
          </button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="responsive-table-wrapper" style={{ maxHeight: 600 }}>
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
              {branchEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {isAdmin
                      ? <input className="input-field" style={{ width: 80 }} value={emp.emp_no}
                          onChange={(e) => updateEmployee(emp.id, 'emp_no', e.target.value)} />
                      : emp.emp_no}
                  </td>
                  <td>
                    {isAdmin ? (
                      <select className="select-field" value={emp.classification}
                        onChange={(e) => updateEmployee(emp.id, 'classification', e.target.value)}>
                        {empClassifications.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : emp.classification}
                  </td>
                  <td>
                    {isAdmin
                      ? <input className="input-field" value={emp.last_name}
                          onChange={(e) => updateEmployee(emp.id, 'last_name', e.target.value)} />
                      : emp.last_name}
                  </td>
                  <td>
                    {isAdmin
                      ? <input className="input-field" value={emp.first_name}
                          onChange={(e) => updateEmployee(emp.id, 'first_name', e.target.value)} />
                      : emp.first_name}
                  </td>
                  <td className="num">
                    {isAdmin
                      ? <input className="input-field num" type="number" step="0.01"
                          value={emp.pay_per_hr} onChange={(e) => updateEmployee(emp.id, 'pay_per_hr', e.target.value)} />
                      : fmt$(emp.pay_per_hr)}
                  </td>
                  <td className="num">
                    {isAdmin
                      ? <input className="input-field num" type="number" step="0.01"
                          value={emp.supplemental_per_hr} onChange={(e) => updateEmployee(emp.id, 'supplemental_per_hr', e.target.value)} />
                      : fmt$(emp.supplemental_per_hr)}
                  </td>
                  <td className="num mono" style={{ fontWeight: 600, color: 'var(--color-pine)' }}>
                    {fmt$(emp.pay_per_hr + emp.supplemental_per_hr)}
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="btn-danger" onClick={() => deleteEmployee(emp.id)} title="Remove">
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

      {showAdd && <AddEmployeeModal onAdd={addEmployee} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddEmployeeModal({ onAdd, onClose }: {
  onAdd: (emp: { emp_no: string; classification: string; last_name: string; first_name: string; pay_per_hr: number; supplemental_per_hr: number }) => void;
  onClose: () => void;
}) {
  const [emp, setEmp] = useState({ emp_no: '', classification: 'Foreman', last_name: '', first_name: '', pay_per_hr: 0, supplemental_per_hr: 0 });
  const upd = (k: string, v: string | number) => setEmp((prev) => ({ ...prev, [k]: (k === 'pay_per_hr' || k === 'supplemental_per_hr') ? (parseFloat(String(v)) || 0) : v }));
  const empClassifications = ['Foreman', 'Climber', 'Groundperson', 'Spray Tech', 'Lawn Tech', 'Operations Manager', 'Nursery- Field', 'Nursery- Mulch Yard', 'Nursery- Driver'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-content modal-card-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 16px' }}>Add employee</h3>
        <div className="modal-form-grid">
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Employee #</label>
            <input className="input-field" value={emp.emp_no} onChange={(e) => upd('emp_no', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Classification</label>
            <select className="select-field" value={emp.classification} onChange={(e) => upd('classification', e.target.value)}>
              {empClassifications.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Last name</label>
            <input className="input-field" value={emp.last_name} onChange={(e) => upd('last_name', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>First name</label>
            <input className="input-field" value={emp.first_name} onChange={(e) => upd('first_name', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Pay / hr</label>
            <input className="input-field num" type="number" step="0.01" value={emp.pay_per_hr} onChange={(e) => upd('pay_per_hr', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Supplemental / hr</label>
            <input className="input-field num" type="number" step="0.01" value={emp.supplemental_per_hr} onChange={(e) => upd('supplemental_per_hr', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onAdd(emp)} disabled={!emp.last_name || !emp.first_name}>
            <Save size={14} /> Add to roster
          </button>
        </div>
      </div>
    </div>
  );
}
