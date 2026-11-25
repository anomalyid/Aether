/**
 * Validator JSON Schema minimalis untuk kontrak capability.
 *
 * Mendukung keyword yang benar-benar dibutuhkan kontrak Aether:
 * type, required, properties, enum, minimum, maximum, minLength,
 * maxLength, items, dan additionalProperties.
 *
 * By Anomalyid.
 */

export interface JsonSchema {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array";
  required?: string[];
  properties?: Record<string, JsonSchema>;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: JsonSchema;
  additionalProperties?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, expected: JsonSchema["type"]): boolean {
  if (expected === undefined) return true;
  if (expected === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeOf(value) === expected;
}

export function validateJsonSchema(
  schema: JsonSchema,
  value: unknown,
  path = "$",
): ValidationResult {
  const errors: string[] = [];

  if (!matchesType(value, schema.type)) {
    errors.push(`${path}: diharapkan tipe ${schema.type}, mendapat ${typeOf(value)}`);
    return { valid: false, errors };
  }

  if (schema.enum !== undefined && !schema.enum.some((item) => item === value)) {
    errors.push(`${path}: nilai tidak termasuk enum yang diizinkan`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: panjang minimal ${schema.minLength} karakter`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: panjang maksimal ${schema.maxLength} karakter`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: nilai minimal ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: nilai maksimal ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.items !== undefined) {
      value.forEach((item, index) => {
        const result = validateJsonSchema(schema.items as JsonSchema, item, `${path}[${index}]`);
        errors.push(...result.errors);
      });
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in object)) errors.push(`${path}.${key}: wajib diisi`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in object) {
        const result = validateJsonSchema(child, object[key], `${path}.${key}`);
        errors.push(...result.errors);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) {
        if (!(key in (schema.properties ?? {}))) {
          errors.push(`${path}.${key}: field tidak dikenal`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
