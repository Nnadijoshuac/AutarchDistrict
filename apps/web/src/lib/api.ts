export type Agent = {
  agentId: string;
  publicKey: string;
  strategy: string;
  policyProfile?: PolicyProfile;
  lastStatus: string;
  lastError?: string;
  lastSignature?: string;
};

export type PolicyProfile = {
  name: string;
  maxLamportsPerTx: number;
  maxDailyLamports: number;
  allowedPrograms: string[];
  maxConcurrentTx: number;
  slippageBps: number;
};

export type PolicyViolation = {
  id: string;
  agentId: string;
  code: string;
  message: string;
  createdAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/backend";

export type DemoSetupPayload = {
  numAgents?: number;
  seedAmount?: number;
  adminFundLamports?: number;
  agentFundLamports?: number;
  reserveLamports?: number;
};

export type DemoSetupResponse = {
  ok: boolean;
  mintA: string;
  mintB: string;
  poolAuthority: string;
  agents: number;
};

export type DemoRunResponse = {
  ok: boolean;
  rounds: number;
  amount: number;
  signatures: string[];
  errors: Array<{ agentId: string; err: string }>;
};

export type DemoStopResponse = {
  ok: boolean;
  signatures: string[];
};

async function parseApiError(res: Response): Promise<Error> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { message?: string };
    return new Error(parsed.message ?? text);
  } catch {
    return new Error(text);
  }
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Network request failed (${reason}). Check NEXT_PUBLIC_API_BASE (${API_BASE}) and backend CORS WEB_ORIGIN.`
    );
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function wakeBackend(maxAttempts = 6, delayMs = 2500): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await apiFetch(`${API_BASE}/health`, { cache: "no-store" });
      if (res.ok) return;
      lastError = await parseApiError(res);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    if (attempt < maxAttempts) {
      await wait(delayMs);
    }
  }
  if (lastError) throw lastError;
}

export async function listAgents(): Promise<Agent[]> {
  const res = await apiFetch(`${API_BASE}/agents`, { cache: "no-store" });
  const body = (await res.json()) as { agents: Agent[] };
  return body.agents;
}

export async function createAgents(count: number): Promise<Agent[]> {
  const res = await apiFetch(`${API_BASE}/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ count })
  });
  const body = (await res.json()) as { agents: Agent[] };
  return body.agents;
}

export async function listStrategies(): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/strategies`, { cache: "no-store" });
  if (!res.ok) {
    throw await parseApiError(res);
  }
  const body = (await res.json()) as { strategies: string[] };
  return body.strategies;
}

export async function updateAgentPolicy(agentId: string, policy: PolicyProfile): Promise<Agent> {
  const res = await apiFetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/policy`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(policy)
  });
  if (!res.ok) {
    throw await parseApiError(res);
  }
  const body = (await res.json()) as { agent: Agent };
  return body.agent;
}

export async function updateAgentStrategy(agentId: string, strategyName: string): Promise<Agent> {
  const res = await apiFetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/strategy`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ strategyName })
  });
  if (!res.ok) {
    throw await parseApiError(res);
  }
  const body = (await res.json()) as { agent: Agent };
  return body.agent;
}

export async function listPolicyViolations(): Promise<PolicyViolation[]> {
  const res = await apiFetch(`${API_BASE}/policy-violations`, { cache: "no-store" });
  if (!res.ok) {
    throw await parseApiError(res);
  }
  const body = (await res.json()) as { violations: PolicyViolation[] };
  return body.violations;
}

export async function setupDemo(payload: DemoSetupPayload = {}): Promise<DemoSetupResponse> {
  const res = await apiFetch(`${API_BASE}/demo/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw await parseApiError(res);
  }
  return (await res.json()) as DemoSetupResponse;
}

export async function runDemo(rounds = 3, amount = 1000): Promise<DemoRunResponse> {
  const res = await apiFetch(`${API_BASE}/demo/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rounds, amount })
  });
  if (!res.ok) {
    throw await parseApiError(res);
  }
  return (await res.json()) as DemoRunResponse;
}

export async function stopDemo(): Promise<DemoStopResponse> {
  const res = await apiFetch(`${API_BASE}/demo/stop`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    throw await parseApiError(res);
  }
  return (await res.json()) as DemoStopResponse;
}
