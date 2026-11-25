/**
 * Policy Engine — evaluasi allow / deny / require_approval.
 *
 * Deny selalu menang. Default adalah deny. Izin tinggi selalu butuh approval.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";
import type {
  AuthorizationRequest,
  Policy,
  PolicyCondition,
  PolicyDecision,
} from "./types.js";
import type { PermissionProvider, PolicyRepository } from "./ports.js";

function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) return value.startsWith(pattern.slice(0, -1));
  return pattern === value;
}

function evaluateCondition(
  condition: PolicyCondition,
  attributes: Record<string, string | number | boolean>,
): boolean {
  const actual = attributes[condition.attribute];
  if (actual === undefined) return false;

  switch (condition.operator) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(String(actual));
    case "gt":
      return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
    case "lt":
      return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
    default:
      return false;
  }
}

function policyMatches(policy: Policy, request: AuthorizationRequest): boolean {
  if (policy.tenantId !== undefined && policy.tenantId !== request.principal.tenantId) return false;
  if (policy.expiresAt !== undefined && Date.parse(policy.expiresAt) <= Date.now()) return false;

  const actionMatch = policy.actions.some((pattern) => matchesPattern(pattern, request.action));
  if (!actionMatch) return false;

  if (policy.capabilities !== undefined) {
    if (request.capability === undefined) return false;
    if (!policy.capabilities.some((pattern) => matchesPattern(pattern, request.capability as string))) {
      return false;
    }
  }

  if (policy.resources !== undefined) {
    if (!policy.resources.some((pattern) => matchesPattern(pattern, request.resource))) return false;
  }

  if (policy.conditions !== undefined) {
    const attributes = request.attributes ?? {};
    if (!policy.conditions.every((condition) => evaluateCondition(condition, attributes))) return false;
  }

  return true;
}

function decision(
  effect: PolicyDecision["decision"],
  policyIds: string[],
  reasonCode: string,
): PolicyDecision {
  return { decision: effect, policyIds, reasonCode, obligations: [] };
}

export class PolicyEngine {
  constructor(
    private readonly policies: PolicyRepository,
    private readonly permissions: PermissionProvider,
  ) {}

  async evaluate(request: AuthorizationRequest): Promise<PolicyDecision> {
    const tenantId = request.principal.tenantId;
    if (tenantId === undefined || tenantId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.TENANT_CONTEXT_REQUIRED,
        "Tenant context wajib untuk evaluasi policy.",
        { category: "authorization", retryable: false },
      );
    }
    if (request.principal.principalId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.AUTHENTICATION_REQUIRED,
        "Principal wajib dikenal sebelum evaluasi policy.",
        { category: "authorization", retryable: false },
      );
    }

    const granted = await this.permissions.getPermissions(request.principal.principalId, tenantId);
    const required = [request.action];
    if (request.capability !== undefined) required.push(request.capability);
    const missing = required.filter((permission) => !granted.includes(permission));

    if (missing.length > 0) {
      return decision("deny", [], "PERMISSION_MISSING");
    }

    const all = await this.policies.list(tenantId);
    const matched = all
      .filter((policy) => policy.enabled && policyMatches(policy, request))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

    if (matched.length === 0) return decision("deny", [], "NO_MATCHING_POLICY");

    const deny = matched.find((policy) => policy.effect === "deny");
    if (deny !== undefined) return decision("deny", [deny.id], "POLICY_DENIED");

    const approval = matched.find((policy) => policy.effect === "require_approval");
    if (approval !== undefined) {
      return decision("require_approval", [approval.id], "APPROVAL_REQUIRED");
    }

    const allow = matched.find((policy) => policy.effect === "allow");
    if (allow === undefined) return decision("deny", [], "NO_MATCHING_POLICY");

    if (request.riskLevel === "high" || request.riskLevel === "critical") {
      return decision("require_approval", [allow.id], "RISK_REQUIRES_APPROVAL");
    }

    return decision("allow", [allow.id], "ALLOWED");
  }
}
