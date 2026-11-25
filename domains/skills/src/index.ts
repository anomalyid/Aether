/**
 * Skills Engine Aether — format Agent Skills dengan progressive disclosure.
 *
 * Metadata dibaca saat discovery, instruksi lengkap saat aktivasi, resource
 * hanya saat dibutuhkan. Skill bukan izin dan bukan jaminan aman.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";

const RECOGNIZED_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "allowed-tools",
  "metadata",
]);

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string;
  metadata?: Record<string, string>;
}

export type SkillTrust = "built-in" | "verified" | "organization" | "community" | "untrusted";

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  trust: SkillTrust;
  instructions: string;
  enabled: boolean;
  frontmatter: SkillFrontmatter;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillMarkdown(raw: string): { frontmatter: SkillFrontmatter; body: string } {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "SKILL.md harus diawali frontmatter '---'.", {
      category: "validation",
      retryable: false,
    });
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Frontmatter SKILL.md tidak ditutup.", {
      category: "validation",
      retryable: false,
    });
  }

  const frontmatter: Record<string, string | Record<string, string>> = {};
  const seen = new Set<string>();
  let section: string | undefined;

  for (const line of lines.slice(1, end)) {
    if (line.trim().length === 0) continue;
    const indented = /^\s+/.test(line);
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1));

    if (indented && section === "metadata") {
      const metadata = (frontmatter.metadata ?? {}) as Record<string, string>;
      metadata[key] = value;
      frontmatter.metadata = metadata;
      continue;
    }

    if (RECOGNIZED_KEYS.has(key)) {
      if (seen.has(key)) {
        throw new AetherError(
          ErrorCode.VALIDATION_ERROR,
          `Field frontmatter ${key} duplikat.`,
          { category: "validation", retryable: false },
        );
      }
      seen.add(key);
      section = key === "metadata" ? "metadata" : undefined;
      frontmatter[key] = key === "metadata" ? {} : value;
    }
  }

  if (typeof frontmatter.name !== "string" || typeof frontmatter.description !== "string") {
    throw new AetherError(
      ErrorCode.VALIDATION_ERROR,
      "SKILL.md wajib memiliki name dan description.",
      { category: "validation", retryable: false },
    );
  }

  return {
    frontmatter: frontmatter as unknown as SkillFrontmatter,
    body: lines.slice(end + 1).join("\n").trim(),
  };
}

export function validateSkill(input: {
  folderName: string;
  raw: string;
}): { frontmatter: SkillFrontmatter; instructions: string } {
  const parsed = parseSkillMarkdown(input.raw);
  const { name, description } = parsed.frontmatter;
  const namePattern = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;

  if (!namePattern.test(name) || name.endsWith("-") || name.includes("--")) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, `Nama skill ${name} tidak valid.`, {
      category: "validation",
      retryable: false,
    });
  }
  if (name !== input.folderName) {
    throw new AetherError(
      ErrorCode.VALIDATION_ERROR,
      "Nama skill harus sama dengan nama folder.",
      { category: "validation", retryable: false, details: { name, folderName: input.folderName } },
    );
  }
  if (description.length < 1 || description.length > 1024) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Description skill harus 1–1024 karakter.", {
      category: "validation",
      retryable: false,
    });
  }
  if (parsed.frontmatter.compatibility !== undefined && parsed.frontmatter.compatibility.length > 500) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Compatibility maksimal 500 karakter.", {
      category: "validation",
      retryable: false,
    });
  }

  return { frontmatter: parsed.frontmatter, instructions: parsed.body };
}

export interface SkillResourceProvider {
  read(skillId: string, relativePath: string): Promise<string | null>;
}

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>();

  constructor(private readonly resources?: SkillResourceProvider) {}

  register(input: {
    folderName: string;
    raw: string;
    version?: string;
    trust?: SkillTrust;
  }): Skill {
    const validated = validateSkill({ folderName: input.folderName, raw: input.raw });
    if (this.skills.has(input.folderName)) {
      throw new AetherError(
        ErrorCode.RESOURCE_CONFLICT,
        `Skill ${input.folderName} sudah terdaftar.`,
        { category: "execution", retryable: false },
      );
    }

    const skill: Skill = {
      id: input.folderName,
      name: validated.frontmatter.name,
      description: validated.frontmatter.description,
      version: input.version ?? "1.0.0",
      trust: input.trust ?? "untrusted",
      instructions: validated.instructions,
      enabled: true,
      frontmatter: validated.frontmatter,
    };
    this.skills.set(skill.id, skill);
    return skill;
  }

  /** Tahap 1 progressive disclosure: hanya name dan description. */
  catalog(): Array<{ id: string; name: string; description: string }> {
    return [...this.skills.values()]
      .filter((skill) => skill.enabled)
      .map((skill) => ({ id: skill.id, name: skill.name, description: skill.description }));
  }

  /** Tahap 2: instruksi lengkap dimuat hanya saat skill aktif. */
  load(id: string): string {
    const skill = this.get(id);
    if (!skill.enabled) {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Skill tidak aktif.", {
        category: "authorization",
        retryable: false,
      });
    }
    return skill.instructions;
  }

  /** Tahap 3: resource only-on-demand dengan perlindungan path traversal. */
  async readResource(id: string, relativePath: string): Promise<string | null> {
    this.get(id);
    if (
      relativePath.startsWith("/") ||
      relativePath.includes("..") ||
      relativePath.includes("\0")
    ) {
      throw new AetherError(ErrorCode.AUTHORIZATION_DENIED, "Path resource skill tidak valid.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (this.resources === undefined) return null;
    return this.resources.read(id, relativePath);
  }

  enable(id: string): void {
    this.get(id).enabled = true;
  }

  disable(id: string): void {
    this.get(id).enabled = false;
  }

  get(id: string): Skill {
    const skill = this.skills.get(id);
    if (skill === undefined) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Skill tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    return skill;
  }
}
