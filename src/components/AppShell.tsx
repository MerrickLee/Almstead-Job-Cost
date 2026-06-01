'use client';

import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import {
  Calculator,
  Settings,
  HardHat,
  Wrench,
  Users,
  Eye,
  Edit3,
  LogOut,
} from 'lucide-react';
import Image from 'next/image';
import CrewsTab from './tabs/CrewsTab';
import WhatIfTab from './tabs/WhatIfTab';
import LaborTab from './tabs/LaborTab';
import EquipmentTab from './tabs/EquipmentTab';
import EmployeesTab from './tabs/EmployeesTab';

export default function AppShell() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const userRole = useAppStore((s) => s.userRole);
  const loading = useAppStore((s) => s.loading);

  const isAdmin = viewMode === 'admin' && userRole === 'admin';
  const canAdmin = userRole === 'admin';

  const tabs = [
    { id: 'crews' as const, label: 'Crew Bid Sheet', icon: Calculator },
    { id: 'whatif' as const, label: 'What If Conditions', icon: Settings, adminOnly: true },
    { id: 'labor' as const, label: 'Labor', icon: HardHat },
    { id: 'equipment' as const, label: 'Equipment', icon: Wrench },
    { id: 'employees' as const, label: 'Employees', icon: Users },
  ];

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-paper)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 16px' }}>
            <img
              src="/logo-icon.png"
              alt="Loading"
              style={{ width: '100%', height: '100%', objectFit: 'contain', animation: 'pulse 1.5s infinite' }}
            />
          </div>
          <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>Loading data...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-paper)' }}>
      {/* ==================== HEADER ==================== */}
      <header
        style={{
          background: 'var(--color-forest)',
          color: 'var(--color-paper)',
          padding: '18px 32px',
          borderBottom: '1px solid var(--color-pine)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, position: 'relative' }}>
                <Image
                  src="/logo-icon.png"
                  alt="Almstead"
                  width={44}
                  height={44}
                  style={{ borderRadius: 6, objectFit: 'contain' }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: 'var(--color-paper)',
                  }}
                >
                  ALMSTEAD
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: '0.18em',
                    color: 'var(--color-fern)',
                    marginTop: -2,
                  }}
                >
                  TREE, SHRUB & LAWN CARE
                </div>
              </div>
            </div>

            {/* Divider + Subtitle */}
            <div
              style={{
                borderLeft: '1px solid var(--color-pine)',
                paddingLeft: 16,
                marginLeft: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600 }}>Product Costing</div>
              <div style={{ fontSize: 11, color: 'var(--color-fern)', letterSpacing: '0.05em' }}>
                Worksheets 2026 · Data as of 5/14/2026
              </div>
            </div>
          </div>

          {/* Right side: View toggle + sign out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {canAdmin && (
              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--color-pine)',
                  borderRadius: 999,
                  padding: 4,
                }}
              >
                <button
                  onClick={() => setViewMode('sales')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: viewMode === 'sales' ? 'var(--color-paper)' : 'transparent',
                    color: viewMode === 'sales' ? 'var(--color-pine)' : 'var(--color-paper)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <Eye size={14} /> SALES VIEW
                </button>
                <button
                  onClick={() => setViewMode('admin')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: viewMode === 'admin' ? 'var(--color-yellow)' : 'transparent',
                    color: viewMode === 'admin' ? 'var(--color-forest)' : 'var(--color-paper)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <Edit3 size={14} /> ADMIN
                </button>
              </div>
            )}
            <button
              onClick={handleSignOut}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-fern)',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                transition: 'color 0.15s',
              }}
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* ==================== TABS ==================== */}
        <nav style={{ display: 'flex', gap: 4, marginTop: 18, marginBottom: -19 }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '12px 20px',
                  background: isActive ? 'var(--color-paper)' : 'transparent',
                  color: isActive ? 'var(--color-pine)' : 'var(--color-fern)',
                  border: 'none',
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: isActive ? '3px solid var(--color-yellow)' : '3px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={15} />
                {t.label}
                {t.adminOnly && viewMode !== 'admin' && (
                  <span style={{ fontSize: 9, opacity: 0.6 }}>(ADMIN)</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ==================== CONTENT ==================== */}
      <main style={{ padding: 32, maxWidth: 1480, margin: '0 auto' }}>
        <div className="animate-fade-in">
          {activeTab === 'crews' && <CrewsTab isAdmin={isAdmin} />}
          {activeTab === 'whatif' && <WhatIfTab isAdmin={isAdmin} />}
          {activeTab === 'labor' && <LaborTab isAdmin={isAdmin} />}
          {activeTab === 'equipment' && <EquipmentTab isAdmin={isAdmin} />}
          {activeTab === 'employees' && <EmployeesTab isAdmin={isAdmin} />}
        </div>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer
        style={{
          marginTop: 60,
          padding: '20px 32px',
          background: 'var(--color-forest)',
          color: 'var(--color-fern)',
          fontSize: 11,
          letterSpacing: '0.05em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>ALMSTEAD TREE, SHRUB & LAWN CARE · FOUNDED 1964</span>
        <span>Replaces the legacy product-costing workbook</span>
      </footer>
    </div>
  );
}
