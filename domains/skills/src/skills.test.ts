import { describe, expect, it } from "vitest";
import { SkillRegistry, parseSkillMarkdown, validateSkill } from "./index";

const skillMarkdown = `---
name: customer-support
description: Membantu agen menangani tiket dukungan pelanggan dengan aman.
license: MIT
compatibility: Memerlukan capability knowledge.search dan messaging.draft.
metadata:
  author: anomalyid
  version: "1.0"
---

# Customer Support

1. Pahami permintaan pelanggan.
2. Ambil pengetahuan yang disetujui.
3. Periksa kebijakan yang berlaku.
4. Minta approval sebelum mengirim pesan.
5. Catat hasilnya.

Lihat [referensi](references/kebijakan.md) bila diperlukan.
`;

describe("Agent Skills", () => {
  it("mem-parsing frontmatter dan isiSKILL.md", () => {
    const parsed = parseSkillMarkdown(skillMarkdown);
    expect(parsed.frontmatter.name).toBe("customer-support");
    expect(parsed.frontmatter.description).toContain("dukungan pelanggan");
    expect(parsed.frontmatter.metadata?.author).toBe("anomalyid");
    expect(parsed.body).toContain("Minta approval");
  });

  it("memvalidasi skill yang benar", () => {
    expect(() => validateSkill({ folderName: "customer-support", raw: skillMarkdown })).not.toThrow();
  });

  it("menolak nama yang tidak cocok dengan folder", () => {
    expect(() => validateSkill({ folderName: "lain", raw: skillMarkdown })).toThrow(/sama dengan nama folder/);
  });

  it("menolak frontmatter tanpa name/description", () => {
    expect(() => parseSkillMarkdown("---\nname: x\n---\nIsi")).toThrow(/name dan description/);
  });

  it("menolak field duplikat", () => {
    const duplikat = skillMarkdown.replace(
      "description: Membantu",
      'description: Duplikat\ndescription: Membantu',
    );
    expect(() => parseSkillMarkdown(duplikat)).toThrow(/duplikat/);
  });
});

describe("Skill Registry — progressive disclosure", () => {
  it("catalog hanya memuat name dan description", () => {
    const registry = new SkillRegistry();
    registry.register({ folderName: "customer-support", raw: skillMarkdown, trust: "organization" });
    const catalog = registry.catalog();

    expect(catalog).toHaveLength(1);
    expect(Object.keys(catalog[0]!).sort()).toEqual(["description", "id", "name"]);
    expect(registry.get("customer-support").trust).toBe("organization");
  });

  it("instruksi lengkap dimuat saat load", () => {
    const registry = new SkillRegistry();
    registry.register({ folderName: "customer-support", raw: skillMarkdown });
    expect(registry.load("customer-support")).toContain("# Customer Support");
  });

  it("menolak load skill yang dinonaktifkan", () => {
    const registry = new SkillRegistry();
    registry.register({ folderName: "customer-support", raw: skillMarkdown });
    registry.disable("customer-support");
    expect(() => registry.load("customer-support")).toThrow(/tidak aktif/);
  });

  it("menolak path traversal pada resource", async () => {
    const registry = new SkillRegistry({ read: async () => "rahasia" });
    registry.register({ folderName: "customer-support", raw: skillMarkdown });
    await expect(registry.readResource("customer-support", "../rahasia.md")).rejects.toThrow(/tidak valid/);
    await expect(registry.readResource("customer-support", "references/kebijakan.md")).resolves.toBe("rahasia");
  });
});
