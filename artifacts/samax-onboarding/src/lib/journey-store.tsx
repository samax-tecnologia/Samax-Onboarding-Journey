import React, { createContext, useContext, useEffect, useReducer, ReactNode, useRef } from "react";
import { PHASES, CUSTOMER_PROFILE, OPPORTUNITIES } from "./constants";

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
}

type Action =
  | { type: "TOGGLE_TASK"; payload: string }
  | { type: "SET_PHASE_STATUS"; payload: { phaseId: string; status: PhaseStatus } }
  | { type: "SET_PHASE_NOTE"; payload: { phaseId: string; note: string } }
  | { type: "SET_PHASE_BLOCKER"; payload: { phaseId: string; blocker: string } }
  | { type: "SET_OPP_DECISION"; payload: { oppId: string; decision: OppDecision } }
  | { type: "UPDATE_CUSTOMER_PROFILE"; payload: Partial<typeof CUSTOMER_PROFILE> }
  | { type: "ADD_NOTIFICATION"; payload: Omit<JourneyNotification, "id" | "createdAt" | "read"> }
  | { type: "MARK_NOTIFICATION_READ"; payload: string }
  | { type: "MARK_ALL_READ" }
  | { type: "LOAD_STATE"; payload: JourneyState };

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
};

const STORAGE_KEY = "samax-journey-v2";
const LEGACY_KEY = "samax-onboarding-progress";
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
  };
}

const JourneyContext = createContext<{
  state: JourneyState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, defaultState);
  const isHydrated = useRef(false);
  const lastWriteRef = useRef<string>("");

  // Hydrate once
  useEffect(() => {
    const savedV2 = localStorage.getItem(STORAGE_KEY);
    if (savedV2) {
      try {
        dispatch({ type: "LOAD_STATE", payload: sanitize(JSON.parse(savedV2)) });
      } catch (e) {
        console.error("Failed to load journey state", e);
      }
    } else {
      const savedV1 = localStorage.getItem(LEGACY_KEY);
      if (savedV1) {
        try {
          const completedTaskIds = JSON.parse(savedV1);
          const migrated = sanitize({ completedTaskIds });
          dispatch({ type: "LOAD_STATE", payload: migrated });
        } catch (e) {}
      }
    }
    isHydrated.current = true;
  }, []);

  // Persist on change
  useEffect(() => {
    if (!isHydrated.current) return;
    const serialized = JSON.stringify(state);
    if (serialized !== lastWriteRef.current) {
      lastWriteRef.current = serialized;
      localStorage.setItem(STORAGE_KEY, serialized);
    }
  }, [state]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
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
  }, []);

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
