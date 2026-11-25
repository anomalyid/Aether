/**
 * UserService — identitas manusia pengguna platform.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";
import { createUserId } from "./ids.js";
import type { User, UserId } from "./types.js";
import type { UserRepository } from "./repositories.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateUserInput {
  email: string;
  displayName: string;
}

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async create(input: CreateUserInput): Promise<User> {
    const email = (input.email ?? "").trim().toLowerCase();
    const displayName = (input.displayName ?? "").trim();

    if (!EMAIL_PATTERN.test(email)) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Format email tidak valid.", {
        category: "validation",
        retryable: false,
      });
    }
    if (displayName.length < 1 || displayName.length > 200) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Nama tampilan harus 1–200 karakter.", {
        category: "validation",
        retryable: false,
      });
    }
    if ((await this.users.findByEmail(email)) !== null) {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "Email sudah terdaftar.", {
        category: "execution",
        retryable: false,
      });
    }

    const now = new Date().toISOString();
    const user: User = {
      id: createUserId(),
      email,
      displayName,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await this.users.save(user);
    return user;
  }

  async get(id: string): Promise<User> {
    const user = await this.users.findById(id as UserId);
    if (user === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "User tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    return user;
  }

  async getByEmail(email: string): Promise<User> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (user === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "User tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    return user;
  }

  async assertActive(id: string): Promise<User> {
    const user = await this.get(id);
    if (user.status !== "active") {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "User tidak dalam keadaan aktif.", {
        category: "authorization",
        retryable: false,
      });
    }
    return user;
  }

  async suspend(id: string): Promise<User> {
    const user = await this.get(id);
    user.status = "suspended";
    user.updatedAt = new Date().toISOString();
    await this.users.save(user);
    return user;
  }

  async activate(id: string): Promise<User> {
    const user = await this.get(id);
    user.status = "active";
    user.updatedAt = new Date().toISOString();
    await this.users.save(user);
    return user;
  }
}
