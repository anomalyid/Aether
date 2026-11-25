/**
 * Penyelesaian dependency graph dengan urutan deterministik (CORE-003).
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";

export interface GraphNode<T> {
  id: string;
  value: T;
  dependencies: readonly string[];
  priority?: number;
}

export function topologicalSort<T>(nodes: readonly GraphNode<T>[]): T[] {
  const byId = new Map<string, GraphNode<T>>();

  for (const node of nodes) {
    if (byId.has(node.id)) {
      throw new AetherError(
        ErrorCode.KERNEL_MODULE_DUPLICATE,
        `Node dengan ID ${node.id} terdaftar lebih dari satu kali.`,
        { category: "dependency", retryable: false, details: { id: node.id } },
      );
    }
    byId.set(node.id, node);
  }

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.dependencies.includes(node.id)) {
      throw new AetherError(
        ErrorCode.KERNEL_MODULE_CYCLE,
        `Node ${node.id} tidak boleh bergantung pada dirinya sendiri.`,
        { category: "dependency", retryable: false, details: { id: node.id } },
      );
    }

    const dependencies = [...new Set(node.dependencies)];
    let count = 0;

    for (const dependency of dependencies) {
      if (!byId.has(dependency)) {
        throw new AetherError(
          ErrorCode.KERNEL_DEPENDENCY_MISSING,
          `Dependency ${dependency} yang dibutuhkan ${node.id} tidak terdaftar.`,
          {
            category: "dependency",
            retryable: false,
            details: { missing: dependency, requiredBy: node.id },
          },
        );
      }
      const list = dependents.get(dependency) ?? [];
      list.push(node.id);
      dependents.set(dependency, list);
      count += 1;
    }

    indegree.set(node.id, count);
  }

  const sortKey = (id: string): string => {
    const node = byId.get(id);
    const priority = node?.priority ?? 100;
    return `${String(priority).padStart(10, "0")}:${id}`;
  };

  const compareIds = (a: string, b: string): number => {
    const keyA = sortKey(a);
    const keyB = sortKey(b);
    if (keyA === keyB) return 0;
    return keyA < keyB ? -1 : 1;
  };

  const ready = nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
    .sort(compareIds);

  const result: T[] = [];

  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined) break;
    const node = byId.get(id);
    if (node === undefined) break;
    result.push(node.value);

    for (const dependent of dependents.get(id) ?? []) {
      const remaining = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) {
        ready.push(dependent);
        ready.sort(compareIds);
      }
    }
  }

  if (result.length !== nodes.length) {
    const stuck = nodes
      .filter((node) => (indegree.get(node.id) ?? 0) > 0)
      .map((node) => node.id)
      .sort();
    throw new AetherError(
      ErrorCode.KERNEL_MODULE_CYCLE,
      "Dependency graph mengandung siklus.",
      { category: "dependency", retryable: false, details: { modules: stuck } },
    );
  }

  return result;
}
