/**
 * TenantService — pembuat dan pengelola batas organisasi.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";
import { createTenantId } from "./ids.js";
import type { Tenant, TenantId } from "./types.js";
import type { TenantRepository } from "./repositories.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CreateTenantInput {
  name: string;
  slug: string;
}

export class TenantService {
  constructor(private readonly tenants: TenantRepository) {}

  async create(input: CreateTenantInput): Promise<Tenant> {
    const name = (input.name ?? "").trim();
    const slug = (input.slug ?? "").trim().toLowerCase();

    if (name.length < 2 || name.length > 200) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Nama tenant harus 2–200 karakter.", {
        category: "validation",
        retryable: false,
      });
    }
    if (slug.length > 64 || !SLUG_PATTERN.test(slug)) {
      throw new AetherError(
        ErrorCode.VALIDATION_ERROR,
        "Slug tenant hanya boleh huruf kecil, angka, dan hyphen.",
        { category: "validation", retryable: false, details: { slug } },
      );
    }
    if ((await this.tenants.findBySlug(slug)) !== null) {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "Slug tenant sudah digunakan.", {
        category: "execution",
        retryable: false,
        details: { slug },
      });
    }

    const now = new Date().toISOString();
    const tenant: Tenant = {
      id: createTenantId(),
      name,
      slug,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await this.tenants.save(tenant);
    return tenant;
  }

  async get(id: string): Promise<Tenant> {
    const tenant = await this.tenants.findById(id as TenantId);
    if (tenant === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Tenant tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    return tenant;
  }

  async assertActive(id: string): Promise<Tenant> {
    const tenant = await this.get(id);
    if (tenant.status !== "active") {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Tenant tidak dalam keadaan aktif.", {
        category: "authorization",
        retryable: false,
      });
    }
    return tenant;
  }

  async suspend(id: string): Promise<Tenant> {
    const tenant = await this.get(id);
    if (tenant.status === "deleted") {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "Tenant yang dihapus tidak dapat disuspend.", {
        category: "execution",
        retryable: false,
      });
    }
    tenant.status = "suspended";
    tenant.updatedAt = new Date().toISOString();
    await this.tenants.save(tenant);
    return tenant;
  }

  async activate(id: string): Promise<Tenant> {
    const tenant = await this.get(id);
    if (tenant.status === "deleted") {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "Tenant yang dihapus tidak dapat diaktifkan.", {
        category: "execution",
        retryable: false,
      });
    }
    tenant.status = "active";
    tenant.updatedAt = new Date().toISOString();
    await this.tenants.save(tenant);
    return tenant;
  }
}
