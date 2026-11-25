/**
 * Pemeriksaan kompatibilitas versi semantic.
 * Tanpa dependency eksternal agar kernel tetap minimal (CORE-001).
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";

export const KERNEL_VERSION = "0.1.0";
export const CONTRACTS_VERSION = "0.1.0";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export function parseVersion(input: string): SemVer {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(input.trim());
  if (match === null) {
    throw new AetherError(
      ErrorCode.KERNEL_CONFIG_INVALID,
      `Versi tidak valid: ${input}`,
      { category: "validation", retryable: false, details: { version: input } },
    );
  }
  const version: SemVer = {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
  if (match[4] !== undefined) version.prerelease = match[4];
  return version;
}

export function compareVersions(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;

  if (a.prerelease === undefined && b.prerelease === undefined) return 0;
  if (a.prerelease === undefined) return 1;
  if (b.prerelease === undefined) return -1;
  if (a.prerelease === b.prerelease) return 0;
  return a.prerelease < b.prerelease ? -1 : 1;
}

function satisfiesComparator(comparator: string, version: SemVer): boolean {
  if (comparator === "*") return true;

  if (comparator.startsWith("^")) {
    const lower = parseVersion(comparator.slice(1));
    let upper: SemVer;
    if (lower.major > 0) {
      upper = { major: lower.major + 1, minor: 0, patch: 0 };
    } else if (lower.minor > 0) {
      upper = { major: 0, minor: lower.minor + 1, patch: 0 };
    } else {
      upper = { major: 0, minor: 0, patch: lower.patch + 1 };
    }
    return compareVersions(version, lower) >= 0 && compareVersions(version, upper) < 0;
  }

  if (comparator.startsWith("~")) {
    const lower = parseVersion(comparator.slice(1));
    const upper: SemVer = { major: lower.major, minor: lower.minor + 1, patch: 0 };
    return compareVersions(version, lower) >= 0 && compareVersions(version, upper) < 0;
  }

  if (comparator.startsWith(">=")) {
    return compareVersions(version, parseVersion(comparator.slice(2))) >= 0;
  }
  if (comparator.startsWith("<=")) {
    return compareVersions(version, parseVersion(comparator.slice(2))) <= 0;
  }
  if (comparator.startsWith(">")) {
    return compareVersions(version, parseVersion(comparator.slice(1))) > 0;
  }
  if (comparator.startsWith("<")) {
    return compareVersions(version, parseVersion(comparator.slice(1))) < 0;
  }
  if (comparator.startsWith("=")) {
    return compareVersions(version, parseVersion(comparator.slice(1))) === 0;
  }
  return compareVersions(version, parseVersion(comparator)) === 0;
}

/** Rentang didukung: *, ^, ~, >=, <=, >, <, =, versi eksak, dan gabungan dipisah spasi/koma. */
export function satisfiesSemver(range: string, version: string): boolean {
  const target = parseVersion(version);
  const comparators = range.trim().split(/[\s,]+/).filter((item) => item.length > 0);
  if (comparators.length === 0) return false;
  return comparators.every((comparator) => satisfiesComparator(comparator, target));
}
