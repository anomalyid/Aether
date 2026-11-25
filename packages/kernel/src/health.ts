/**
 * Manajemen health Aether: liveness, readiness, dan dependency health.
 *
 * Health check dilarang melakukan perubahan state bisnis dan dilarang
 * membocorkan credential atau konfigurasi sensitif.
 *
 * By Anomalyid.
 */

import type { HealthResult, HealthStatus } from "@aether/contracts";
import { redactSecrets } from "@aether/errors";

export interface HealthComponent extends HealthResult {
  id: string;
}

export interface HealthReport {
  status: HealthStatus;
  checkedAt: string;
  components: HealthComponent[];
}

export type HealthCheck = () => Promise<HealthResult>;

const STATUS_RANK: Record<HealthStatus, number> = {
  healthy: 0,
  degraded: 1,
  unhealthy: 2,
};

export class HealthManager {
  private readonly checks = new Map<string, HealthCheck>();
  private ready = false;

  register(id: string, check: HealthCheck): void {
    this.checks.set(id, check);
  }

  unregister(id: string): void {
    this.checks.delete(id);
  }

  setReady(value: boolean): void {
    this.ready = value;
  }

  isReady(): boolean {
    return this.ready;
  }

  async liveness(): Promise<HealthReport> {
    const component: HealthComponent = {
      id: "process",
      status: "healthy",
      checkedAt: new Date().toISOString(),
      message: "Proses aktif.",
    };
    return this.aggregate([component]);
  }

  async readiness(): Promise<HealthReport> {
    const components = await this.runChecks();
    components.push({
      id: "application",
      status: this.ready ? "healthy" : "unhealthy",
      checkedAt: new Date().toISOString(),
      message: this.ready ? "Aplikasi siap menerima traffic." : "Aplikasi belum siap menerima traffic.",
    });
    return this.aggregate(components);
  }

  async dependencies(): Promise<HealthReport> {
    return this.aggregate(await this.runChecks());
  }

  async report(): Promise<HealthReport> {
    return this.readiness();
  }

  private async runChecks(): Promise<HealthComponent[]> {
    const components: HealthComponent[] = [];

    for (const [id, check] of this.checks) {
      try {
        const result = await check();
        components.push({
          id,
          status: result.status,
          checkedAt: result.checkedAt,
          ...(result.message === undefined ? {} : { message: result.message }),
          ...(result.details === undefined
            ? {}
            : { details: redactSecrets(result.details) as Record<string, unknown> }),
        });
      } catch (error) {
        components.push({
          id,
          status: "unhealthy",
          checkedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message : "Health check gagal.",
        });
      }
    }

    return components;
  }

  private aggregate(components: HealthComponent[]): HealthReport {
    const status = components.reduce<HealthStatus>((worst, component) => {
      return STATUS_RANK[component.status] > STATUS_RANK[worst] ? component.status : worst;
    }, "healthy");

    return {
      status,
      checkedAt: new Date().toISOString(),
      components,
    };
  }
}
