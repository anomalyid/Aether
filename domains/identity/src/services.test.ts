import { describe, expect, it } from "vitest";
import { createMemoryIdentityRepositories } from "@aether/database";
import {
  MembershipService,
  PrincipalService,
  RoleService,
  TenantService,
  UserService,
  assertTenantContext,
  assertTenantMatch,
} from "./index";

function siapkan() {
  const repositori = createMemoryIdentityRepositories();
  return {
    repositori,
    tenants: new TenantService(repositori.tenants),
    users: new UserService(repositori.users),
    roles: new RoleService(repositori.roles, repositori.tenants),
    memberships: new MembershipService(
      repositori.memberships,
      repositori.tenants,
      repositori.users,
      repositori.roles,
    ),
    principals: new PrincipalService(repositori.principals, repositori.tenants),
  };
}

describe("Identity Domain — tenant dan user", () => {
  it("membuat tenant dengan slug normal dan status aktif", async () => {
    const { tenants } = siapkan();
    const tenant = await tenants.create({ name: "Anomalyid", slug: "Anomaly-ID" });
    expect(tenant.slug).toBe("anomaly-id");
    expect(tenant.status).toBe("active");
    expect(tenant.id).toMatch(/^tenant_/);
  });

  it("menolak slug tidak valid dan slug duplikat", async () => {
    const { tenants } = siapkan();
    await expect(tenants.create({ name: "Salah", slug: "TIDAK_VALID" })).rejects.toThrow(/slug/i);
    await tenants.create({ name: "Pertama", slug: "pertama" });
    await expect(tenants.create({ name: "Kedua", slug: "pertama" })).rejects.toThrow(
      /sudah digunakan/,
    );
  });

  it("mengubah status tenant suspend dan aktif kembali", async () => {
    const { tenants } = siapkan();
    const tenant = await tenants.create({ name: "Uji", slug: "uji" });
    await tenants.suspend(tenant.id);
    await expect(tenants.assertActive(tenant.id)).rejects.toThrow(/keadaan aktif/);
    await tenants.activate(tenant.id);
    await expect(tenants.assertActive(tenant.id)).resolves.toMatchObject({ status: "active" });
  });

  it("membuat user dengan email dinormalisasi dan menolak duplikat", async () => {
    const { users } = siapkan();
    const user = await users.create({
      email: "Ibra@Example.COM",
      displayName: "Ibra Ramdan",
    });
    expect(user.email).toBe("ibra@example.com");
    await expect(
      users.create({ email: "ibra@example.com", displayName: "Duplikat" }),
    ).rejects.toThrow(/sudah terdaftar/);
  });
});

describe("Identity Domain — role, membership, dan permission", () => {
  it("memberikan gabungan permission dari seluruh role aktif", async () => {
    const ctx = siapkan();
    const tenantA = await ctx.tenants.create({ name: "Tenant A", slug: "tenant-a" });
    const user = await ctx.users.create({ email: "a@example.com", displayName: "User A" });
    const admin = await ctx.roles.create({ tenantId: tenantA.id, name: "admin" });
    const reviewer = await ctx.roles.create({ tenantId: tenantA.id, name: "reviewer" });

    await ctx.roles.grantPermission(tenantA.id, admin.id, "agent.run", "Menjalankan agent");
    await ctx.roles.grantPermission(tenantA.id, reviewer.id, "audit.read", "Membaca audit");

    await ctx.memberships.addMember({ tenantId: tenantA.id, userId: user.id, roleId: admin.id });
    await ctx.memberships.addMember({ tenantId: tenantA.id, userId: user.id, roleId: reviewer.id });

    expect(await ctx.memberships.getPermissions(user.id, tenantA.id)).toEqual([
      "agent.run",
      "audit.read",
    ]);
    expect(await ctx.memberships.hasRole(user.id, tenantA.id, "admin")).toBe(true);
  });

  it("menolak role dari tenant lain untuk membership", async () => {
    const ctx = siapkan();
    const tenantA = await ctx.tenants.create({ name: "Tenant A", slug: "tenant-a" });
    const tenantB = await ctx.tenants.create({ name: "Tenant B", slug: "tenant-b" });
    const user = await ctx.users.create({ email: "b@example.com", displayName: "User B" });
    const roleB = await ctx.roles.create({ tenantId: tenantB.id, name: "admin" });

    await expect(
      ctx.memberships.addMember({ tenantId: tenantA.id, userId: user.id, roleId: roleB.id }),
    ).rejects.toThrow(/tidak tersedia dalam tenant ini/);
  });

  it("tidak membocorkan permission tenant lain", async () => {
    const ctx = siapkan();
    const tenantA = await ctx.tenants.create({ name: "Tenant A", slug: "tenant-a" });
    const tenantB = await ctx.tenants.create({ name: "Tenant B", slug: "tenant-b" });
    const user = await ctx.users.create({ email: "c@example.com", displayName: "User C" });
    const roleA = await ctx.roles.create({ tenantId: tenantA.id, name: "admin" });
    await ctx.roles.grantPermission(tenantA.id, roleA.id, "tenant.manage", "Mengelola tenant");
    await ctx.memberships.addMember({ tenantId: tenantA.id, userId: user.id, roleId: roleA.id });

    expect(await ctx.memberships.getPermissions(user.id, tenantB.id)).toEqual([]);
  });

  it("menghapus membership dengan mengubah status menjadi removed", async () => {
    const ctx = siapkan();
    const tenant = await ctx.tenants.create({ name: "Uji", slug: "uji" });
    const user = await ctx.users.create({ email: "d@example.com", displayName: "User D" });
    const role = await ctx.roles.create({ tenantId: tenant.id, name: "viewer" });
    await ctx.memberships.addMember({ tenantId: tenant.id, userId: user.id, roleId: role.id });
    await ctx.memberships.removeMember(tenant.id, user.id);

    expect(await ctx.memberships.listByTenant(tenant.id)).toHaveLength(0);
  });
});

describe("Identity Domain — principal", () => {
  it("menghasilkan principal yang sama untuk subject yang sama", async () => {
    const { principals } = siapkan();
    const tenant = await principals.ensure({
      tenantId: undefined,
      principalType: "service",
      subjectId: "sistem-aether",
    });
    const tenantLagi = await principals.ensure({
      tenantId: undefined,
      principalType: "service",
      subjectId: "sistem-aether",
    });
    expect(tenant.id).toBe(tenantLagi.id);
    expect(tenant.principalType).toBe("service");
  });

  it("mencabut principal dan menolak penggunaan ulang", async () => {
    const ctx = siapkan();
    const tenant = await ctx.tenants.create({ name: "Uji", slug: "uji" });
    const principal = await ctx.principals.forUser("user-1", tenant.id);
    await ctx.principals.revoke(principal.id);

    await expect(
      ctx.principals.assertInTenant(principal.id, tenant.id),
    ).rejects.toThrow(/tidak aktif/);
    await expect(ctx.principals.forUser("user-1", tenant.id)).rejects.toThrow(/dicabut/);
  });

  it("menolak principal lintas tenant", async () => {
    const ctx = siapkan();
    const tenantA = await ctx.tenants.create({ name: "Tenant A", slug: "a" });
    const tenantB = await ctx.tenants.create({ name: "Tenant B", slug: "b" });
    const principal = await ctx.principals.forUser("user-1", tenantA.id);

    await expect(
      ctx.principals.assertInTenant(principal.id, tenantB.id),
    ).rejects.toThrow(/tidak tersedia dalam tenant ini/);
  });
});

describe("Guard tenant boundary", () => {
  it("membutuhkan tenant context", () => {
    expect(() => assertTenantContext(undefined)).toThrow(/Tenant context wajib/);
    expect(assertTenantContext("tenant_1")).toBe("tenant_1");
  });

  it("membandingkan tenant resource secara ketat", () => {
    expect(() => assertTenantMatch("tenant_1", "tenant_2")).toThrow(/tidak tersedia/);
    expect(() => assertTenantMatch("tenant_1", "tenant_1")).not.toThrow();
  });
});
