'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/lib/store';
import AppShell from '@/components/AppShell';
import {
  SEED_BRANCHES,
  SEED_CLASSIFICATIONS,
  SEED_WHAT_IF,
  SEED_EMPLOYEES,
  SEED_EQUIPMENT,
} from '@/lib/seed-data';

export default function HomePage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const setAuth = useAppStore((s) => s.setAuth);
  const setData = useAppStore((s) => s.setData);
  const setLoading = useAppStore((s) => s.setLoading);
  const setDataLoaded = useAppStore((s) => s.setDataLoaded);
  const initCrews = useAppStore((s) => s.initCrews);
  const dataLoaded = useAppStore((s) => s.dataLoaded);

  // Load demo/seed data directly into the store
  const loadDemoData = () => {
    const laborSelections: Record<string, Record<string, string>> = {};
    for (const b of SEED_BRANCHES) {
      laborSelections[b.id] = {
        Foreman: 'AVG', Climber: 'AVG', Groundman: 'AVG', 'Other-1': 'AVG', 'Other-2': 'AVG',
      };
    }

    setData({
      whatIf: SEED_WHAT_IF,
      classifications: SEED_CLASSIFICATIONS,
      branches: SEED_BRANCHES,
      employees: SEED_EMPLOYEES,
      equipment: SEED_EQUIPMENT,
      laborSelections,
    });
    initCrews(SEED_BRANCHES.map((b) => b.id));
    setDataLoaded(true);
    setLoading(false);
  };

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          setAuth(
            user.id,
            (profile?.role as 'sales' | 'admin') || 'sales',
            user.email || null
          );
          setIsAuthenticated(true);
        }
      } catch {
        // Supabase unavailable — will show login page
      }
      setAuthChecked(true);
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          setAuth(
            session.user.id,
            (profile?.role as 'sales' | 'admin') || 'sales',
            session.user.email || null
          );
          setIsAuthenticated(true);
        } else if (event === 'SIGNED_OUT') {
          setAuth(null, 'sales', null);
          setIsAuthenticated(false);
          setDemoMode(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [setAuth]);

  // Load data from Supabase when authenticated
  useEffect(() => {
    if ((!isAuthenticated && !demoMode) || dataLoaded) return;

    if (demoMode) {
      loadDemoData();
      return;
    }

    const supabase = createClient();

    async function loadData() {
      setLoading(true);

      const [
        { data: whatIfData },
        { data: classificationsData },
        { data: branchesData },
        { data: employeesData },
        { data: equipmentData },
        { data: laborSelectionsData },
      ] = await Promise.all([
        supabase.from('what_if').select('*').single(),
        supabase.from('classifications').select('*').order('sort_order'),
        supabase.from('branches').select('*').order('sort_order'),
        supabase.from('employees').select('*').eq('active', true).order('last_name'),
        supabase.from('equipment').select('*').eq('active', true).order('truck_number'),
        supabase.from('labor_selections').select('*'),
      ]);

      const laborSelections: Record<string, Record<string, string>> = {};
      if (laborSelectionsData) {
        for (const ls of laborSelectionsData) {
          if (!laborSelections[ls.branch_id]) laborSelections[ls.branch_id] = {};
          laborSelections[ls.branch_id][ls.classification_label] = ls.selection;
        }
      }

      const whatIf = whatIfData ? {
        profit_pct: Number(whatIfData.profit_pct),
        contrib_margin_pct: Number(whatIfData.contrib_margin_pct),
        fuel_per_gal: Number(whatIfData.fuel_per_gal),
        emergency_mult: Number(whatIfData.emergency_mult),
      } : null;

      const classifications = (classificationsData || []).map((c) => ({
        ...c,
        reg_wage: Number(c.reg_wage),
        reg_supp: Number(c.reg_supp),
        ot_wage: Number(c.ot_wage),
        ot_supp: Number(c.ot_supp),
      }));

      const branches = (branchesData || []).map((b) => ({
        ...b,
        wc_rate: Number(b.wc_rate),
        pr_rate: Number(b.pr_rate),
        medical_per_hr: Number(b.medical_per_hr),
        overhead_per_hr: Number(b.overhead_per_hr),
        storm_bonus_per_8h: Number(b.storm_bonus_per_8h),
      }));

      const employees = (employeesData || []).map((e) => ({
        ...e,
        pay_per_hr: Number(e.pay_per_hr),
        supplemental_per_hr: Number(e.supplemental_per_hr),
      }));

      const equipment = (equipmentData || []).map((eq) => ({
        ...eq,
        fuel_gph: Number(eq.fuel_gph),
        annual_maint: Number(eq.annual_maint),
        annual_lic: Number(eq.annual_lic),
        days_used_per_year: Number(eq.days_used_per_year),
      }));

      setData({ whatIf, classifications, branches, employees, equipment, laborSelections });

      if (branches.length > 0) {
        initCrews(branches.map((b) => b.id));
      }

      setDataLoaded(true);
      setLoading(false);
    }

    loadData();
  }, [isAuthenticated, demoMode, dataLoaded, setData, setLoading, setDataLoaded, initCrews]);

  // Set up realtime subscriptions (only in live mode)
  useEffect(() => {
    if (!isAuthenticated || !dataLoaded || demoMode) return;

    const supabase = createClient();
    const channel = supabase
      .channel('realtime-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'what_if' }, () => {
        supabase.from('what_if').select('*').single().then(({ data }) => {
          if (data) {
            setData({
              whatIf: {
                profit_pct: Number(data.profit_pct),
                contrib_margin_pct: Number(data.contrib_margin_pct),
                fuel_per_gal: Number(data.fuel_per_gal),
                emergency_mult: Number(data.emergency_mult),
              },
            });
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        supabase.from('employees').select('*').eq('active', true).order('last_name').then(({ data }) => {
          if (data) {
            setData({
              employees: data.map((e) => ({ ...e, pay_per_hr: Number(e.pay_per_hr), supplemental_per_hr: Number(e.supplemental_per_hr) })),
            });
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, () => {
        supabase.from('equipment').select('*').eq('active', true).order('truck_number').then(({ data }) => {
          if (data) {
            setData({
              equipment: data.map((eq) => ({ ...eq, fuel_gph: Number(eq.fuel_gph), annual_maint: Number(eq.annual_maint), annual_lic: Number(eq.annual_lic), days_used_per_year: Number(eq.days_used_per_year) })),
            });
          }
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, demoMode, dataLoaded, setData]);

  if (!authChecked) return <LoadingScreen />;

  if (!isAuthenticated && !demoMode) {
    return <LoginPage onDemoMode={() => {
      setDemoMode(true);
      setAuth('demo-user', 'admin', 'demo@almstead.com');
      setIsAuthenticated(false); // Not truly authenticated
    }} />;
  }

  return <AppShell />;
}

// =============================================================================
// Login Page
// =============================================================================

function LoginPage({ onDemoMode }: { onDemoMode: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: '' } },
      });
      if (error) setError(error.message);
      else setError('Check your email for a confirmation link.');
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--color-paper)',
    }}>
      <div style={{ width: 400, padding: 40, textAlign: 'center' }} className="animate-fade-in">
        {/* Logo */}
        <div style={{ width: 72, height: 72, margin: '0 auto 24px' }}>
          <img src="/logo-icon.png" alt="Almstead"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700,
          color: 'var(--color-ink)', margin: '0 0 4px', letterSpacing: '0.02em',
        }}>ALMSTEAD</h1>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.18em',
          color: 'var(--color-emerald)', marginBottom: 8,
        }}>TREE, SHRUB & LAWN CARE</div>
        <div style={{
          fontSize: 16, fontWeight: 600, color: 'var(--color-pine)', marginBottom: 32,
        }}>Product Costing</div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              style={{ fontFamily: 'var(--font-sans)', padding: '12px 16px', fontSize: 14 }}
              required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <input type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              style={{ fontFamily: 'var(--font-sans)', padding: '12px 16px', fontSize: 14 }}
              required minLength={6} />
          </div>

          {error && (
            <div style={{
              color: error.includes('Check') ? 'var(--color-emerald)' : 'var(--color-rust)',
              fontSize: 13, marginBottom: 16, padding: '8px 12px',
              background: error.includes('Check') ? 'var(--color-mist)' : 'rgba(198, 71, 31, 0.08)',
              borderRadius: 6,
            }}>{error}</div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px 20px' }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: 13, color: 'var(--color-muted)' }}>
          {mode === 'login' ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => setMode('signup')}
                style={{ background: 'none', border: 'none', color: 'var(--color-emerald)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--color-emerald)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Demo Mode */}
        <div style={{
          marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-border)',
        }}>
          <button onClick={onDemoMode}
            className="btn-ghost"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}>
            Preview with demo data →
          </button>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8 }}>
            All 75 employees · 203 equipment · Live formulas
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Loading Screen
// =============================================================================

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--color-paper)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 16px' }}>
          <img src="/logo-icon.png" alt="Loading"
            style={{ width: '100%', height: '100%', objectFit: 'contain', animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ color: 'var(--color-muted)', fontSize: 13, letterSpacing: '0.05em' }}>Loading...</div>
      </div>
    </div>
  );
}
