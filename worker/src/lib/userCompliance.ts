export type ComplianceAckInput = {
  privacyPolicyAccepted?: boolean;
  termsOfServiceAccepted?: boolean;
  age13Confirmed?: boolean;
};

export function validateComplianceAck(input: ComplianceAckInput): string | null {
  if (!input.privacyPolicyAccepted) {
    return "You must agree to the privacy policy.";
  }
  if (!input.termsOfServiceAccepted) {
    return "You must agree to the terms of service.";
  }
  if (!input.age13Confirmed) {
    return "You must confirm that you are over the age of 13.";
  }
  return null;
}

export function complianceFlagsFromRow(row: {
  privacy_policy_accepted_at?: number | null;
  terms_of_service_accepted_at?: number | null;
  age_13_confirmed_at?: number | null;
}): {
  privacy_policy_accepted: boolean;
  terms_of_service_accepted: boolean;
  age_13_confirmed: boolean;
} {
  return {
    privacy_policy_accepted: row.privacy_policy_accepted_at != null,
    terms_of_service_accepted: row.terms_of_service_accepted_at != null,
    age_13_confirmed: row.age_13_confirmed_at != null,
  };
}

export function complianceComplete(flags: {
  privacy_policy_accepted?: boolean;
  terms_of_service_accepted?: boolean;
  age_13_confirmed?: boolean;
}): boolean {
  return Boolean(
    flags.privacy_policy_accepted && flags.terms_of_service_accepted && flags.age_13_confirmed,
  );
}
