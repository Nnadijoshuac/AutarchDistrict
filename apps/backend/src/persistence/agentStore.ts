import { Prisma } from "@prisma/client";
import type { AgentState } from "../agents/types.js";
import type { PolicyViolationDetail } from "../policy/txPolicyEngine.js";
import { prisma } from "./db.js";

type StoredSecretRecord = {
  encryptedSecret: string;
  encryptedDataKey: string;
};

export class AgentStore {
  async upsertAgent(state: AgentState, secretRecord: StoredSecretRecord): Promise<void> {
    await prisma.agent.upsert({
      where: { id: state.agentId },
      update: {
        publicKey: state.publicKey,
        encryptedSecret: secretRecord.encryptedSecret,
        encryptedDataKey: secretRecord.encryptedDataKey,
        policyProfile: state.policyProfile as unknown as Prisma.InputJsonValue,
        strategyName: state.strategy
      },
      create: {
        id: state.agentId,
        publicKey: state.publicKey,
        encryptedSecret: secretRecord.encryptedSecret,
        encryptedDataKey: secretRecord.encryptedDataKey,
        policyProfile: state.policyProfile as unknown as Prisma.InputJsonValue,
        strategyName: state.strategy,
        isActive: false
      }
    });
  }

  async setAgentActive(agentId: string, isActive: boolean): Promise<void> {
    await prisma.agent.updateMany({ where: { id: agentId }, data: { isActive } });
  }

  async updateAgentPolicy(agentId: string, policyProfile: unknown): Promise<void> {
    await prisma.agent.updateMany({
      where: { id: agentId },
      data: { policyProfile: policyProfile as Prisma.InputJsonValue }
    });
  }

  async updateAgentStrategy(agentId: string, strategyName: string): Promise<void> {
    await prisma.agent.updateMany({ where: { id: agentId }, data: { strategyName } });
  }

  async listAgents(): Promise<
    Array<{
      agentId: string;
      publicKey: string;
      isActive: boolean;
      strategyName: string;
      policyProfile: Prisma.JsonValue;
    }>
  > {
    const rows = await prisma.agent.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({
      agentId: row.id,
      publicKey: row.publicKey,
      isActive: row.isActive,
      strategyName: row.strategyName,
      policyProfile: row.policyProfile
    }));
  }

  async recordTransaction(input: {
    agentId: string;
    status: "ok" | "error";
    action?: string;
    strategy?: string;
    rationale?: string;
    riskScore?: number;
    signature?: string;
    reason?: string;
  }): Promise<void> {
    await prisma.transaction.create({
      data: {
        agentId: input.agentId,
        action: input.action,
        strategy: input.strategy,
        rationale: input.rationale,
        riskScore: input.riskScore,
        status: input.status,
        signature: input.signature,
        reason: input.reason
      }
    });
  }

  async recordPolicyViolation(detail: PolicyViolationDetail): Promise<void> {
    await prisma.policyViolation.create({
      data: {
        agentId: detail.agentId,
        code: detail.code,
        message: detail.message
      }
    });
  }

  async listPolicyViolations(limit = 200): Promise<
    Array<{
      id: string;
      agentId: string;
      code: string;
      message: string;
      createdAt: string;
    }>
  > {
    const rows = await prisma.policyViolation.findMany({
      take: limit,
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      code: row.code,
      message: row.message,
      createdAt: row.createdAt.toISOString()
    }));
  }
}
