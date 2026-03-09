import { Prisma } from "@prisma/client";
import type { AgentState } from "../agents/types.js";
import type { PolicyViolationDetail } from "../policy/txPolicyEngine.js";
import { prisma } from "./db.js";

type StoredSecretRecord = {
  encryptedSecret: string;
  encryptedDataKey: string;
  keyId: string;
};

export class AgentStore {
  async upsertAgent(state: AgentState, secretRecord: StoredSecretRecord): Promise<void> {
    await prisma.agent.upsert({
      where: { id: state.agentId },
      update: {
        publicKey: state.publicKey,
        displayName: state.displayName,
        encryptedSecret: secretRecord.encryptedSecret,
        encryptedDataKey: secretRecord.encryptedDataKey,
        keyId: secretRecord.keyId,
        policyProfile: state.policyProfile as unknown as Prisma.InputJsonValue,
        strategyName: state.strategy
      },
      create: {
        id: state.agentId,
        publicKey: state.publicKey,
        displayName: state.displayName,
        encryptedSecret: secretRecord.encryptedSecret,
        encryptedDataKey: secretRecord.encryptedDataKey,
        keyId: secretRecord.keyId,
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

  async updateAgentDisplayName(agentId: string, displayName: string): Promise<void> {
    await prisma.agent.updateMany({ where: { id: agentId }, data: { displayName } });
  }

  async deleteAgent(agentId: string): Promise<void> {
    await prisma.agent.deleteMany({ where: { id: agentId } });
  }

  async listAgents(): Promise<
    Array<{
      agentId: string;
      publicKey: string;
      displayName: string | null;
      isActive: boolean;
      strategyName: string;
      encryptedSecret: string;
      encryptedDataKey: string;
      keyId: string;
      policyProfile: Prisma.JsonValue;
    }>
  > {
    const rows = await prisma.agent.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({
      agentId: row.id,
      publicKey: row.publicKey,
      displayName: row.displayName,
      isActive: row.isActive,
      strategyName: row.strategyName,
      encryptedSecret: row.encryptedSecret,
      encryptedDataKey: row.encryptedDataKey,
      keyId: row.keyId,
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

  async listRecentTransactions(limit = 200): Promise<
    Array<{
      agentId: string;
      action: string | null;
      status: string;
      signature: string | null;
      reason: string | null;
      createdAt: string;
    }>
  > {
    const rows = await prisma.transaction.findMany({
      take: limit,
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => ({
      agentId: row.agentId,
      action: row.action,
      status: row.status,
      signature: row.signature,
      reason: row.reason,
      createdAt: row.createdAt.toISOString()
    }));
  }
}
