import React, { createContext, useContext, useEffect, useReducer, ReactNode } from "react";
import { PHASES, CUSTOMER_PROFILE, CUSTOMER_STAGES, OPPORTUNITIES } from "./constants";

export type PhaseStatus = "not-started" | "in-progress" | "blocked" | "done";
export type OppDecision = "pending" | "approved" | "rejected" | "deferred";

export interface JourneyState {
  completedTaskIds: string[];
  phaseStatuses: Record<string, PhaseStatus>;
  phaseNotes: Record<string, string>;
  phaseBlockers: Record<string, string>;
  phaseUpdatedAt: Record<string, string>;
  opportunityDecisions: Record<string, OppDecision>;
  capturedValue: { realizada: number; aprovada: number; evitada: number; governanca: number };
  customerProfile: typeof CUSTOMER_PROFILE;
}

type Action = 
  | { type: "TOGGLE_TASK"; payload: string }
  | { type: "SET_PHASE_STATUS"; payload: { phaseId: string; status: PhaseStatus } }
  | { type: "SET_PHASE_NOTE"; payload: { phaseId: string; note: string } }
  | { type: "SET_PHASE_BLOCKER"; payload: { phaseId: string; blocker: string } }
  | { type: "SET_OPP_DECISION"; payload: { oppId: string; decision: OppDecision } }
  | { type: "UPDATE_CUSTOMER_PROFILE"; payload: Partial<typeof CUSTOMER_PROFILE> }
  | { type: "LOAD_STATE"; payload: JourneyState };

const defaultState: JourneyState = {
  completedTaskIds: [],
  phaseStatuses: {},
  phaseNotes: {},
  phaseBlockers: {},
  phaseUpdatedAt: {},
  opportunityDecisions: {},
  capturedValue: {
    realizada: 5000, // mock already realized
    aprovada: 8000,  // mock already approved
    evitada: 0,
    governanca: 0,
  },
  customerProfile: CUSTOMER_PROFILE,
};

function journeyReducer(state: JourneyState, action: Action): JourneyState {
  let newState = state;
  switch (action.type) {
    case "TOGGLE_TASK": {
      const taskId = action.payload;
      const isCompleted = state.completedTaskIds.includes(taskId);
      newState = {
        ...state,
        completedTaskIds: isCompleted
          ? state.completedTaskIds.filter(id => id !== taskId)
          : [...state.completedTaskIds, taskId]
      };
      break;
    }
    case "SET_PHASE_STATUS":
      newState = {
        ...state,
        phaseStatuses: { ...state.phaseStatuses, [action.payload.phaseId]: action.payload.status },
        phaseUpdatedAt: { ...state.phaseUpdatedAt, [action.payload.phaseId]: new Date().toISOString() }
      };
      break;
    case "SET_PHASE_NOTE":
      newState = {
        ...state,
        phaseNotes: { ...state.phaseNotes, [action.payload.phaseId]: action.payload.note },
        phaseUpdatedAt: { ...state.phaseUpdatedAt, [action.payload.phaseId]: new Date().toISOString() }
      };
      break;
    case "SET_PHASE_BLOCKER":
      newState = {
        ...state,
        phaseBlockers: { ...state.phaseBlockers, [action.payload.phaseId]: action.payload.blocker },
        phaseUpdatedAt: { ...state.phaseUpdatedAt, [action.payload.phaseId]: new Date().toISOString() }
      };
      break;
    case "SET_OPP_DECISION": {
      const { oppId, decision } = action.payload;
      const opportunityDecisions = { ...state.opportunityDecisions, [oppId]: decision };
      
      // Recompute aprovada
      let newAprovada = 8000; // base mock
      OPPORTUNITIES.forEach(opp => {
        if (opportunityDecisions[opp.id] === "approved") {
          newAprovada += opp.annual;
        }
      });
      
      newState = {
        ...state,
        opportunityDecisions,
        capturedValue: { ...state.capturedValue, aprovada: newAprovada }
      };
      break;
    }
    case "UPDATE_CUSTOMER_PROFILE":
      newState = {
        ...state,
        customerProfile: { ...state.customerProfile, ...action.payload }
      };
      break;
    case "LOAD_STATE":
      return action.payload;
    default:
      return state;
  }
  
  localStorage.setItem("samax-journey-v2", JSON.stringify(newState));
  return newState;
}

const JourneyContext = createContext<{
  state: JourneyState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(journeyReducer, defaultState);

  useEffect(() => {
    const savedV2 = localStorage.getItem("samax-journey-v2");
    if (savedV2) {
      try {
        dispatch({ type: "LOAD_STATE", payload: JSON.parse(savedV2) });
      } catch (e) {
        console.error(e);
      }
    } else {
      const savedV1 = localStorage.getItem("samax-onboarding-progress");
      if (savedV1) {
        try {
          const completedTaskIds = JSON.parse(savedV1);
          const migrated: JourneyState = { ...defaultState, completedTaskIds };
          dispatch({ type: "LOAD_STATE", payload: migrated });
          localStorage.setItem("samax-journey-v2", JSON.stringify(migrated));
        } catch (e) {}
      }
    }
  }, []);

  return (
    <JourneyContext.Provider value={{ state, dispatch }}>
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used within JourneyProvider");
  
  const { state, dispatch } = ctx;

  const actions = {
    toggleTask: (taskId: string) => dispatch({ type: "TOGGLE_TASK", payload: taskId }),
    setPhaseStatus: (phaseId: string, status: PhaseStatus) => dispatch({ type: "SET_PHASE_STATUS", payload: { phaseId, status } }),
    setPhaseNote: (phaseId: string, note: string) => dispatch({ type: "SET_PHASE_NOTE", payload: { phaseId, note } }),
    setPhaseBlocker: (phaseId: string, blocker: string) => dispatch({ type: "SET_PHASE_BLOCKER", payload: { phaseId, blocker } }),
    setOppDecision: (oppId: string, decision: OppDecision) => dispatch({ type: "SET_OPP_DECISION", payload: { oppId, decision } }),
    updateCustomerProfile: (profile: Partial<typeof CUSTOMER_PROFILE>) => dispatch({ type: "UPDATE_CUSTOMER_PROFILE", payload: profile }),
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
    let currentPhase = "1.1";
    let lastActivity = "";

    PHASES.forEach(phase => {
      const isComplete = phase.tasks.every(t => state.completedTaskIds.includes(t.id));
      if (isComplete) completedPhases++;
      else if (currentPhase === "1.1") currentPhase = phase.id; // First incomplete
      
      const updated = state.phaseUpdatedAt[phase.id];
      if (updated && (!lastActivity || updated > lastActivity)) {
        lastActivity = updated;
      }
    });

    const msDiff = Date.now() - new Date(state.customerProfile.kickoffDate).getTime();
    const daysSinceKickoff = Math.floor(msDiff / (1000 * 60 * 60 * 24));

    return { completedPhases, totalPhases, currentPhase, lastActivity, daysSinceKickoff };
  };

  return { state, actions, selectors: { getMetaMinima, getCapturedTotal, getJourneyHealth } };
}