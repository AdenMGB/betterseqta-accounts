export const PFP_AUDIT_REASONS = ['Violent', 'Sexual', 'Spam', 'Hateful', 'Other'] as const

export type PfpAuditReason = (typeof PFP_AUDIT_REASONS)[number]
