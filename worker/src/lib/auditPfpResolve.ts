import type { PfpHistoryEntry } from "./pfpHistory";

export type PfpAuditRef =
  | { slot: "current" }
  | { slot: "history"; historyId: string }
  | { slot: "snapshot"; url: string }
  | { slot: "cleared" }
  | { slot: "unavailable" };

export type PfpAuditContext = {
  from: PfpAuditRef;
  to: PfpAuditRef;
};

export type ResolvedPfpSide = {
  available: boolean;
  url?: string;
  label: string;
};

export type LivePfpStack = {
  userId: string;
  pfpUrl?: string | null;
  pfpHistory: PfpHistoryEntry[];
};

export function buildPfpAuditContext(from: PfpAuditRef, to: PfpAuditRef): PfpAuditContext {
  return { from, to };
}

export function resolvePfpAuditRefs(
  userId: string,
  context: PfpAuditContext,
  liveStack: LivePfpStack,
): { from: ResolvedPfpSide; to: ResolvedPfpSide } {
  return {
    from: resolveOneRef(userId, context.from, liveStack),
    to: resolveOneRef(userId, context.to, liveStack),
  };
}

function resolveOneRef(userId: string, ref: PfpAuditRef, liveStack: LivePfpStack): ResolvedPfpSide {
  if (ref.slot === "unavailable") {
    return { available: false, label: "No longer available" };
  }
  if (ref.slot === "cleared") {
    return {
      available: true,
      url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      label: "Cleared",
    };
  }
  if (ref.slot === "snapshot") {
    return { available: true, url: ref.url, label: "Before" };
  }
  if (ref.slot === "current") {
    if (liveStack.pfpUrl) {
      return { available: true, url: liveStack.pfpUrl, label: "Current" };
    }
    const newestHistory = liveStack.pfpHistory[0];
    if (newestHistory) {
      return { available: true, url: newestHistory.r2Key, label: "Past" };
    }
    return { available: false, label: "No longer available" };
  }
  const entry = liveStack.pfpHistory.find((h) => h.id === ref.historyId);
  if (entry) {
    return { available: true, url: entry.r2Key, label: "Past" };
  }
  return { available: false, label: "No longer available" };
}
