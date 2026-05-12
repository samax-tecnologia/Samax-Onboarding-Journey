import React, { createContext, useContext, useEffect, useReducer, ReactNode, useRef } from "react";
import { PHASES, CUSTOMER_PROFILE, OPPORTUNITIES } from "./constants";
import { useTenant } from "./tenant-store";

export type PhaseStatus = "not-started" | "in-progress" | "blocked" | "done";
export type OppDecision = "pending" | "approved" | "rejected" | "deferred";
export type NotificationKind = "phase-status" | "phase-blocker" | "phase-note" | "milestone" | "next-action" | "opportunity";

export interface JourneyNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface PreActivationFlags {
  contractSigned: boolean;
  contractSignedAt: string | null;
  channelAccessGranted: boolean;
  channelAccessGrantedAt: string | null;
  channelType: "slack" | "teams" | "whatsapp" | "other" | null;
  channelName: string | null;
  bobBotConnected: boolean;
  bobBotConnectedAt: string | null;
}

export interface EngagementMilestones {
  diagnostico: string;
  assinatura: string;
  kickoff: string;
  baselineDefinition: string;
}

export interface ManualBaselineEntry {
  id: string;
  provider: string;
  service: string;
  monthlyValue: number;
}

export interface ManualBaseline {
  periodStart: string;
  periodEnd: string;
  entries: ManualBaselineEntry[];
}

export interface JourneyState {
  completedTaskIds: string[];
  phaseStatuses: Record<string, PhaseStatus>;
  phaseNotes: Record<string, string>;
  phaseBlockers: Record<string, string>;
  phaseUpdatedAt: Record<string, string>;
  opportunityDecisions: Record<string, OppDecision>;
  capturedValue: { realizada: number; aprovada: number; evitada: number; governanca: number };
  customerProfile: typeof CUSTOMER_PROFILE;
  notifications: JourneyNotification[];
  preActivationFlags: PreActivationFlags;
  engagementMilestones: EngagementMilestones;
  manualBaseline: ManualBaseline;
}

type Action =
  | { type: "TOGGLE_TASK"; payload: string }
  | { type: "MARK_TASKS_COMPLETE"; payload: string[] }
  | { type: "SET_PHASE_STATUS"; payload: { phaseId: string; status: PhaseStatus } }
  | { type: "SET_PHASE_NOTE"; payload: { phaseId: string; note: string } }
  | { type: "SET_PHASE_BLOCKER"; payload: { phaseId: string; blocker: string } }
  | { type: "SET_OPP_DECISION"; payload: { oppId: string; decision: OppDecision } }
  | { type: "UPDATE_CUSTOMER_PROFILE"; payload: Partial<typeof CUSTOMER_PROFILE> }
  | { type: "ADD_NOTIFICATION"; payload: Omit<JourneyNotification, "id" | "createdAt" | "read"> }
  | { type: "MARK_NOTIFICATION_READ"; payload: string }
  | { type: "MARK_ALL_READ" }
  | { type: "SET_PRE_ACTIVATION_FLAG"; payload: Partial<PreActivationFlags> }
  | { type: "SET_ENGAGEMENT_MILESTONES"; payload: Partial<EngagementMilestones> }
  | { type: "SET_MANUAL_BASELINE_PERIOD"; payload: { periodStart?: string; periodEnd?: string } }
  | { type: "ADD_MANUAL_BASELINE_ENTRY"; payload: Omit<ManualBaselineEntry, "id"> }
  | { type: "UPDATE_MANUAL_BASELINE_ENTRY"; payload: ManualBaselineEntry }
  | { type: "REMOVE_MANUAL_BASELINE_ENTRY"; payload: string }
  | { type: "LOAD_STATE"; payload: JourneyState };

const defaultEngagementMilestones: EngagementMilestones = {
  diagnostico: "2026-03-10",
  assinatura: "2026-04-01",
  kickoff: CUSTOMER_PROFILE.kickoffDate,
  baselineDefinition: "2026-04-29",
};

const defaultManualBaseline: ManualBaseline = {
  periodStart: "",
  periodEnd: "",
  entries: [],
};

const defaultPreActivationFlags: PreActivationFlags = {
  contractSigned: false,
  contractSignedAt: null,
  channelAccessGranted: false,
  channelAccessGrantedAt: null,
  channelType: null,
  channelName: null,
  bobBotConnected: false,
  bobBotConnectedAt: null,
};

const defaultState: JourneyState = {
  completedTaskIds: [],
  phaseStatuses: {},
  phaseNotes: {},
  phaseBlockers: {},
  phaseUpdatedAt: {},
  opportunityDecisions: {},
  capturedValue: {
    realizada: 5000,
    aprovada: 8000,
    evitada: 0,
    governanca: 0,
  },
  customerProfile: CUSTOMER_PROFILE,
  notifications: [],
  preActivationFlags: defaultPreActivationFlags,
  engagementMilestones: defaultEngagementMilestones,
  manualBaseline: defaultManualBaseline,
};

const STORAGE_KEY_PREFIX = "samax-journey-v2";
const LEGACY_KEY = "samax-onboarding-progress";
const LEGACY_GLOBAL_KEY = "samax-journey-v2";

function storageKeyFor(tenantId: string) {
  return `${STORAGE_KEY_PREFIX}:${tenantId}`;
}
const NOTIFICATION_LIMIT = 50;

function genId(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function reduce(state: JourneyState, action: Action): JourneyState {
  switch (action.type) {
    case "TOGGLE_TASK": {
      const taskId = action.payload;
      const isCompleted = state.completedTaskIds.includes(taskId);
      return {
        ...state,
        completedTaskIds: isCompleted
          ? state.completedTaskIds.filter((id) => id !== taskId)
          : [...state.completedTaskIds, taskId],
      };
    }
    case "MARK_TASKS_COMPLETE": {
      const ids = action.payload;
      const set = new Set(state.completedTaskIds);
      let changed = false;
      for (const id of ids) {
        if (!set.has(id)) {
          set.add(id);
          changed = true;
        }
      }
      if (!changed) return state;
      return { ...state, completedTaskIds: Array.from(set) };
    }
    case "SET_PHASE_STATUS":
      return {
        ...state,
        phaseStatuses: { ...state.phaseStatuses, [action.payload.phaseId]: action.payload.status },
        phaseUpdatedAt: { ...state.phaseUpdatedAt, [action.payload.phaseId]: new Date().toISOString() },
      };
    case "SET_PHASE_NOTE":
      return {
        ...state,
        phaseNotes: { ...state.phaseNotes, [action.payload.phaseId]: action.payload.note },
        phaseUpdatedAt: { ...state.phaseUpdatedAt, [action.payload.phaseId]: new Date().toISOString() },
      };
    case "SET_PHASE_BLOCKER":
      return {
        ...state,
        phaseBlockers: { ...state.phaseBlockers, [action.payload.phaseId]: action.payload.blocker },
        phaseUpdatedAt: { ...state.phaseUpdatedAt, [action.payload.phaseId]: new Date().toISOString() },
      };
    case "SET_OPP_DECISION": {
      const { oppId, decision } = action.payload;
      const opportunityDecisions = { ...state.opportunityDecisions, [oppId]: decision };
      let newAprovada = 8000;
      OPPORTUNITIES.forEach((opp) => {
        if (opportunityDecisions[opp.id] === "approved") newAprovada += opp.annual;
      });
      return {
        ...state,
        opportunityDecisions,
        capturedValue: { ...state.capturedValue, aprovada: newAprovada },
      };
    }
    case "UPDATE_CUSTOMER_PROFILE":
      return { ...state, customerProfile: { ...state.customerProfile, ...action.payload } };
    case "ADD_NOTIFICATION": {
      const n: JourneyNotification = {
        id: genId(),
        createdAt: new Date().toISOString(),
        read: false,
        ...action.payload,
      };
      return {
        ...state,
        notifications: [n, ...state.notifications].slice(0, NOTIFICATION_LIMIT),
      };
    }
    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };
    case "MARK_ALL_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    case "SET_PRE_ACTIVATION_FLAG":
      return {
        ...state,
        preActivationFlags: { ...state.preActivationFlags, ...action.payload },
      };
    case "SET_ENGAGEMENT_MILESTONES":
      return {
        ...state,
        engagementMilestones: { ...state.engagementMilestones, ...action.payload },
      };
    case "SET_MANUAL_BASELINE_PERIOD":
      return {
        ...state,
        manualBaseline: { ...state.manualBaseline, ...action.payload },
      };
    case "ADD_MANUAL_BASELINE_ENTRY": {
      const entry: ManualBaselineEntry = { id: genId(), ...action.payload };
      return {
        ...state,
        manualBaseline: {
          ...state.manualBaseline,
          entries: [...state.manualBaseline.entries, entry],
        },
      };
    }
    case "UPDATE_MANUAL_BASELINE_ENTRY":
      return {
        ...state,
        manualBaseline: {
          ...state.manualBaseline,
          entries: state.manualBaseline.entries.map((e) =>
            e.id === action.payload.id ? action.payload : e
          ),
        },
      };
    case "REMOVE_MANUAL_BASELINE_ENTRY":
      return {
        ...state,
        manualBaseline: {
          ...state.manualBaseline,
          entries: state.manualBaseline.entries.filter((e) => e.id !== action.payload),
        },
      };
    case "LOAD_STATE":
      return action.payload;
    default:
      return state;
  }
}

function sanitize(raw: unknown): JourneyState {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<JourneyState>;
  return {
    ...defaultState,
    ...obj,
    completedTaskIds: Array.isArray(obj.completedTaskIds)
      ? obj.completedTaskIds.filter((x): x is string => typeof x === "string")
      : [],
    phaseStatuses: obj.phaseStatuses && typeof obj.phaseStatuses === "object" ? obj.phaseStatuses : {},
    phaseNotes: obj.phaseNotes && typeof obj.phaseNotes === "object" ? obj.phaseNotes : {},
    phaseBlockers: obj.phaseBlockers && typeof obj.phaseBlockers === "object" ? obj.phaseBlockers : {},
    phaseUpdatedAt: obj.phaseUpdatedAt && typeof obj.phaseUpdatedAt === "object" ? obj.phaseUpdatedAt : {},
    opportunityDecisions:
      obj.opportunityDecisions && typeof obj.opportunityDecisions === "object" ? obj.opportunityDecisions : {},
    capturedValue: { ...defaultState.capturedValue, ...(obj.capturedValue ?? {}) },
    customerProfile: { ...defaultState.customerProfile, ...(obj.customerProfile ?? {}) },
    notifications: Array.isArray(obj.notifications) ? obj.notifications : [],
    preActivationFlags: {
      ...defaultPreActivationFlags,
      ...(obj.preActivationFlags && typeof obj.preActivationFlags === "object"
        ? obj.preActivationFlags
        : {}),
    },
    engagementMilestones: {
      ...defaultEngagementMilestones,
      ...(obj.engagementMilestones && typeof obj.engagementMilestones === "object"
        ? obj.engagementMilestones
        : {}),
    },
    manualBaseline: (() => {
      const mb = obj.manualBaseline as ManualBaseline | undefined;
      return {
        periodStart: typeof mb?.periodStart === "string" ? mb.periodStart : "",
        periodEnd: typeof mb?.periodEnd === "string" ? mb.periodEnd : "",
        entries: Array.isArray(mb?.entries) ? mb!.entries : [],
      };
    })(),
  };
}

const JourneyContext = createContext<{
  state: JourneyState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useTenant();
  const [state, dispatch] = useReducer(reduce, defaultState);
  const isHydrated = useRef(false);
  const lastWriteRef = useRef<string>("");
  const currentKeyRef = useRef<string>(storageKeyFor(tenantId));

  // Hydrate / re-hydrate when tenant changes.
  useEffect(() => {
    const key = storageKeyFor(tenantId);
    currentKeyRef.current = key;
    isHydrated.current = false;
    lastWriteRef.current = "";

    const savedV2 = localStorage.getItem(key);
    if (savedV2) {
      try {
        dispatch({ type: "LOAD_STATE", payload: sanitize(JSON.parse(savedV2)) });
      } catch (e) {
        console.error("Failed to load journey state", e);
        dispatch({ type: "LOAD_STATE", payload: defaultState });
      }
    } else {
      // One-time migration from legacy global keys, only into the very first
      // tenant a user lands on (so we don't pollute every tenant with the same
      // legacy progress).
      const legacyGlobal = localStorage.getItem(LEGACY_GLOBAL_KEY);
      const legacyV1 = localStorage.getItem(LEGACY_KEY);
      let migrated = false;
      if (legacyGlobal) {
        try {
          dispatch({ type: "LOAD_STATE", payload: sanitize(JSON.parse(legacyGlobal)) });
          migrated = true;
        } catch (e) { /* ignore */ }
      } else if (legacyV1) {
        try {
          const completedTaskIds = JSON.parse(legacyV1);
          dispatch({ type: "LOAD_STATE", payload: sanitize({ completedTaskIds }) });
          migrated = true;
        } catch (e) { /* ignore */ }
      }
      if (!migrated) {
        dispatch({ type: "LOAD_STATE", payload: defaultState });
      }
      // Clear legacy keys so they only seed once.
      try {
        if (legacyGlobal) localStorage.removeItem(LEGACY_GLOBAL_KEY);
        if (legacyV1) localStorage.removeItem(LEGACY_KEY);
      } catch { /* ignore */ }
    }
    isHydrated.current = true;
  }, [tenantId]);

  // Persist on change (under the current tenant's key).
  useEffect(() => {
    if (!isHydrated.current) return;
    const serialized = JSON.stringify(state);
    if (serialized !== lastWriteRef.current) {
      lastWriteRef.current = serialized;
      localStorage.setItem(currentKeyRef.current, serialized);
    }
  }, [state]);

  // Cross-tab sync (only react to writes on the current tenant's key).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key !== currentKeyRef.current || !e.newValue) return;
      if (e.newValue === lastWriteRef.current) return;
      try {
        const next = sanitize(JSON.parse(e.newValue));
        lastWriteRef.current = e.newValue;
        dispatch({ type: "LOAD_STATE", payload: next });
      } catch (err) {
        console.error("Cross-tab sync failed", err);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [tenantId]);

  return <JourneyContext.Provider value={{ state, dispatch }}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used within JourneyProvider");

  const { state, dispatch } = ctx;

  const addNotification = (n: Omit<JourneyNotification, "id" | "createdAt" | "read">) =>
    dispatch({ type: "ADD_NOTIFICATION", payload: n });

  const actions = {
    toggleTask: (taskId: string) => dispatch({ type: "TOGGLE_TASK", payload: taskId }),
    markTasksComplete: (taskIds: string[]) => dispatch({ type: "MARK_TASKS_COMPLETE", payload: taskIds }),
    setPhaseStatus: (phaseId: string, status: PhaseStatus, notify = false) => {
      const prev = state.phaseStatuses[phaseId] ?? "not-started";
      dispatch({ type: "SET_PHASE_STATUS", payload: { phaseId, status } });
      if (notify && prev !== status) {
        const phase = PHASES.find((p) => p.id === phaseId);
        if (status === "blocked") {
          addNotification({
            kind: "phase-blocker",
            title: "Sua jornada precisa de atenção",
            body: `O time Samax sinalizou um ponto que pode travar o avanço: ${phase?.title ?? phaseId}`,
            link: "/",
          });
        } else if (status === "done") {
          addNotification({
            kind: "milestone",
            title: "Etapa concluída pelo time Samax",
            body: `${phase?.title ?? phaseId} foi finalizada. Sua jornada avançou.`,
            link: "/",
          });
        } else if (status === "in-progress") {
          addNotification({
            kind: "phase-status",
            title: "O time Samax começou uma nova etapa",
            body: `Estamos trabalhando em: ${phase?.title ?? phaseId}`,
            link: "/",
          });
        }
      }
    },
    setPhaseNote: (phaseId: string, note: string) =>
      dispatch({ type: "SET_PHASE_NOTE", payload: { phaseId, note } }),
    setPhaseBlocker: (phaseId: string, blocker: string, notify = false) => {
      const prev = state.phaseBlockers[phaseId] ?? "";
      dispatch({ type: "SET_PHASE_BLOCKER", payload: { phaseId, blocker } });
      if (notify && prev.trim() === "" && blocker.trim() !== "") {
        const phase = PHASES.find((p) => p.id === phaseId);
        addNotification({
          kind: "phase-blocker",
          title: "Novo bloqueio identificado",
          body: `Em "${phase?.title ?? phaseId}": ${blocker.slice(0, 120)}${blocker.length > 120 ? "…" : ""}`,
          link: "/",
        });
      }
    },
    setOppDecision: (oppId: string, decision: OppDecision) =>
      dispatch({ type: "SET_OPP_DECISION", payload: { oppId, decision } }),
    updateCustomerProfile: (profile: Partial<typeof CUSTOMER_PROFILE>) =>
      dispatch({ type: "UPDATE_CUSTOMER_PROFILE", payload: profile }),
    addNotification,
    markNotificationRead: (id: string) => dispatch({ type: "MARK_NOTIFICATION_READ", payload: id }),
    markAllNotificationsRead: () => dispatch({ type: "MARK_ALL_READ" }),
    setPreActivationFlag: (payload: Partial<PreActivationFlags>) =>
      dispatch({ type: "SET_PRE_ACTIVATION_FLAG", payload }),
    setEngagementMilestones: (payload: Partial<EngagementMilestones>) =>
      dispatch({ type: "SET_ENGAGEMENT_MILESTONES", payload }),
    setManualBaselinePeriod: (payload: { periodStart?: string; periodEnd?: string }) =>
      dispatch({ type: "SET_MANUAL_BASELINE_PERIOD", payload }),
    addManualBaselineEntry: (entry: Omit<ManualBaselineEntry, "id">) =>
      dispatch({ type: "ADD_MANUAL_BASELINE_ENTRY", payload: entry }),
    updateManualBaselineEntry: (entry: ManualBaselineEntry) =>
      dispatch({ type: "UPDATE_MANUAL_BASELINE_ENTRY", payload: entry }),
    removeManualBaselineEntry: (id: string) =>
      dispatch({ type: "REMOVE_MANUAL_BASELINE_ENTRY", payload: id }),
  };

  const getMetaMinima = () => {
    const p = state.customerProfile;
    return Math.min(p.contractAnnual * 2, p.spendAnnual * 0.1);
  };

  const getCapturedTotal = () => {
    const cv = state.capturedValue;
    return cv.realizada + cv.aprovada + cv.evitada + cv.governanca;
  };

  const getJourneyHealth = () => {
    const totalPhases = PHASES.length;
    let completedPhases = 0;
    let firstIncomplete: string | null = null;
    let lastActivity = "";

    PHASES.forEach((phase) => {
      const isComplete = phase.tasks.every((t) => state.completedTaskIds.includes(t.id));
      if (isComplete) completedPhases++;
      else if (firstIncomplete === null) firstIncomplete = phase.id;

      const updated = state.phaseUpdatedAt[phase.id];
      if (updated && (!lastActivity || updated > lastActivity)) {
        lastActivity = updated;
      }
    });

    const currentPhase = firstIncomplete ?? PHASES[PHASES.length - 1].id;
    const msDiff = Date.now() - new Date(state.customerProfile.kickoffDate).getTime();
    const daysSinceKickoff = Math.floor(msDiff / (1000 * 60 * 60 * 24));

    return { completedPhases, totalPhases, currentPhase, lastActivity, daysSinceKickoff };
  };

  const getUnreadCount = () => state.notifications.filter((n) => !n.read).length;

  return {
    state,
    actions,
    selectors: { getMetaMinima, getCapturedTotal, getJourneyHealth, getUnreadCount },
  };
}
