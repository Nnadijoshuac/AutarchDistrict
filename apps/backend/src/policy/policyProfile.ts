export interface PolicyProfile {
  name: string;
  maxLamportsPerTx: number;
  maxDailyLamports: number;
  allowedPrograms: string[];
  maxConcurrentTx: number;
  slippageBps: number;
}

export const STRICT_PROFILE: PolicyProfile = {
  name: "strict",
  maxLamportsPerTx: 50_000_000,
  maxDailyLamports: 200_000_000,
  allowedPrograms: [],
  maxConcurrentTx: 1,
  slippageBps: 30
};

export const SANDBOX_PROFILE: PolicyProfile = {
  name: "sandbox",
  maxLamportsPerTx: 2_000_000_000,
  maxDailyLamports: 20_000_000_000,
  allowedPrograms: [],
  maxConcurrentTx: 5,
  slippageBps: 500
};

export function profileByName(name?: string): PolicyProfile {
  if (name === STRICT_PROFILE.name) {
    return STRICT_PROFILE;
  }
  return SANDBOX_PROFILE;
}
