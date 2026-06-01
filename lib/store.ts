'use client';

import { create } from 'zustand';
import type {
  Branch,
  Classification,
  WhatIf,
  EmployeeRow,
  EquipmentRow,
  CrewConfig,
  LaborSelections,
  FormulaContext,
} from '@/lib/formulas/types';

// =============================================================================
// Store Types
// =============================================================================

export type ViewMode = 'sales' | 'admin';

type AppState = {
  // Auth
  userId: string | null;
  userRole: 'sales' | 'admin';
  userEmail: string | null;

  // UI state
  activeTab: 'crews' | 'whatif' | 'labor' | 'equipment' | 'employees';
  viewMode: ViewMode;
  otMode: boolean;
  activeBranch: string | null;

  // Data from Supabase
  whatIf: WhatIf | null;
  classifications: Classification[];
  branches: Branch[];
  employees: EmployeeRow[];
  equipment: EquipmentRow[];
  laborSelections: LaborSelections;

  // Crew configurations (ephemeral, per-branch)
  crews: Record<string, CrewConfig>;

  // Loading states
  loading: boolean;
  dataLoaded: boolean;

  // Actions
  setAuth: (userId: string | null, role: 'sales' | 'admin', email: string | null) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setViewMode: (mode: ViewMode) => void;
  setOtMode: (ot: boolean) => void;
  setActiveBranch: (branchId: string) => void;
  setData: (data: Partial<Pick<AppState, 'whatIf' | 'classifications' | 'branches' | 'employees' | 'equipment' | 'laborSelections'>>) => void;
  setLoading: (loading: boolean) => void;
  setDataLoaded: (loaded: boolean) => void;

  // Crew actions
  updateEquipSlot: (branchId: string, slotIndex: number, equipmentId: string | null) => void;
  updateLaborSlot: (branchId: string, slotIndex: number, classification: string | null) => void;
  resetCrew: (branchId: string) => void;
  initCrews: (branchIds: string[]) => void;

  // Labor selection actions
  setLaborSelection: (branchId: string, classification: string, selection: string) => void;
  resetLaborSelections: (branchId: string) => void;

  // Computed
  getFormulaContext: () => FormulaContext | null;
};

// =============================================================================
// Default crew config
// =============================================================================

function emptyCrewConfig(branchId: string): CrewConfig {
  return {
    branchId,
    equipment: [
      { equipmentId: null },
      { equipmentId: null },
      { equipmentId: null },
    ],
    labor: [
      { classification: null },
      { classification: null },
      { classification: null },
      { classification: null },
      { classification: null },
    ],
  };
}

// =============================================================================
// Store
// =============================================================================

export const useAppStore = create<AppState>((set, get) => ({
  // Auth
  userId: null,
  userRole: 'sales',
  userEmail: null,

  // UI state
  activeTab: 'crews',
  viewMode: 'sales',
  otMode: false,
  activeBranch: null,

  // Data
  whatIf: null,
  classifications: [],
  branches: [],
  employees: [],
  equipment: [],
  laborSelections: {},

  // Crews
  crews: {},

  // Loading
  loading: true,
  dataLoaded: false,

  // Actions
  setAuth: (userId, role, email) => set({ userId, userRole: role, userEmail: email }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setOtMode: (ot) => set({ otMode: ot }),
  setActiveBranch: (branchId) => set({ activeBranch: branchId }),
  setLoading: (loading) => set({ loading }),
  setDataLoaded: (loaded) => set({ dataLoaded: loaded }),

  setData: (data) => set((state) => {
    const newState = { ...state, ...data };
    // Auto-set active branch if not set yet
    if (!state.activeBranch && data.branches && data.branches.length > 0) {
      newState.activeBranch = data.branches[0].id;
    }
    return newState;
  }),

  updateEquipSlot: (branchId, slotIndex, equipmentId) =>
    set((state) => {
      const crew = state.crews[branchId] || emptyCrewConfig(branchId);
      const newEquipment = [...crew.equipment];
      newEquipment[slotIndex] = { equipmentId };
      return {
        crews: {
          ...state.crews,
          [branchId]: { ...crew, equipment: newEquipment },
        },
      };
    }),

  updateLaborSlot: (branchId, slotIndex, classification) =>
    set((state) => {
      const crew = state.crews[branchId] || emptyCrewConfig(branchId);
      const newLabor = [...crew.labor];
      newLabor[slotIndex] = { classification };
      return {
        crews: {
          ...state.crews,
          [branchId]: { ...crew, labor: newLabor },
        },
      };
    }),

  resetCrew: (branchId) =>
    set((state) => ({
      crews: {
        ...state.crews,
        [branchId]: emptyCrewConfig(branchId),
      },
    })),

  initCrews: (branchIds) =>
    set((state) => {
      const crews = { ...state.crews };
      for (const id of branchIds) {
        if (!crews[id]) {
          crews[id] = emptyCrewConfig(id);
        }
      }
      return { crews };
    }),

  setLaborSelection: (branchId, classification, selection) =>
    set((state) => ({
      laborSelections: {
        ...state.laborSelections,
        [branchId]: {
          ...(state.laborSelections[branchId] || {}),
          [classification]: selection,
        },
      },
    })),

  resetLaborSelections: (branchId) =>
    set((state) => ({
      laborSelections: {
        ...state.laborSelections,
        [branchId]: {
          Foreman: 'AVG',
          Climber: 'AVG',
          Groundman: 'AVG',
          'Other-1': 'AVG',
          'Other-2': 'AVG',
        },
      },
    })),

  getFormulaContext: () => {
    const state = get();
    if (!state.whatIf) return null;
    return {
      whatIf: state.whatIf,
      classifications: state.classifications,
      branches: state.branches,
      employees: state.employees,
      equipment: state.equipment,
      laborSelections: state.laborSelections,
    };
  },
}));
