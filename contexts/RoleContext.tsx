"use client";
import { createContext, useContext } from "react";

export type Role = "admin" | "tecnico" | "asistente" | "botaguas";

export interface RoleContextValue {
  role: Role;
  staffId: string | null;
}

export const RoleContext = createContext<RoleContextValue>({ role: "asistente", staffId: null });

export const useRole    = () => useContext(RoleContext).role;
export const useStaffId = () => useContext(RoleContext).staffId;
