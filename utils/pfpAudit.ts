export type PfpAuditRef =
  | { slot: 'current' }
  | { slot: 'history'; historyId: string }
  | { slot: 'snapshot'; url: string }
  | { slot: 'cleared' }
  | { slot: 'unavailable' }

export type ResolvedPfpSide = {
  available: boolean
  url?: string
  label: string
}

export function resolvePfpAuditContextClient(
  userId: string,
  context: { from?: PfpAuditRef; to?: PfpAuditRef },
): { from: ResolvedPfpSide; to: ResolvedPfpSide } | null {
  if (!context.from || !context.to) return null
  return {
    from: resolveOneRef(userId, context.from),
    to: resolveOneRef(userId, context.to),
  }
}

function resolveOneRef(userId: string, ref: PfpAuditRef): ResolvedPfpSide {
  if (ref.slot === 'unavailable') {
    return { available: false, label: 'No longer available' }
  }
  if (ref.slot === 'cleared') {
    return {
      available: true,
      url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      label: 'Cleared',
    }
  }
  if (ref.slot === 'snapshot') {
    return { available: true, url: ref.url, label: 'Before' }
  }
  return { available: false, label: 'No longer available' }
}
