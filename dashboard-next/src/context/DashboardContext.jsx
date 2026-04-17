import { createContext } from "preact";
import { useContext } from "preact/hooks";
import useDashboardState from "../hooks/useDashboardState.js";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const value = useDashboardState();
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext() {
  const value = useContext(DashboardContext);
  if (!value) {
    throw new Error("Dashboard context is unavailable outside DashboardProvider.");
  }

  return value;
}
