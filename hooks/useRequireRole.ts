"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole, type Role } from "@/contexts/RoleContext";

export function useRequireRole(allowed: Role[]) {
  const role = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!allowed.includes(role)) {
      router.replace("/dashboard/agenda");
    }
  }, [role]);
}
