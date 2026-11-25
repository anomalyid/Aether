/**
 * CLI Aether — perintah development dan inspeksi.
 *
 * By Anomalyid.
 */

export interface CliCapability {
  id: string;
  version?: string;
}

export interface CliAgent {
  id: string;
  version?: string;
  name?: string;
}

export interface CliSkill {
  id: string;
  name?: string;
}

export interface CliRun {
  id: string;
  state: string;
  approvalId?: string;
}

export interface CliClient {
  capabilities: { list(): Promise<CliCapability[]> };
  agents: { list(): Promise<CliAgent[]>; getRun(id: string): Promise<CliRun> };
  skills: { list(): Promise<CliSkill[]> };
  executions: { list(): Promise<CliRun[]> };
}

export interface CliOptions {
  client?: CliClient;
  out?: (line: string) => void;
  env?: Readonly<Record<string, string | undefined>>;
}

const PENGGUNAAN = `Aether CLI — The Fabric of Intelligence

Perintah:
  aether doctor
  aether capabilities list
  aether agents list
  aether skills list
  aether executions inspect <id>
  aether help
`;

export async function runCli(argv: string[], options: CliOptions = {}): Promise<number> {
  const out = options.out ?? console.log;
  const env = options.env ?? process.env;
  const [group, action, arg] = argv;

  if (group === undefined || group === "help" || group === "--help") {
    out(PENGGUNAAN);
    return 0;
  }

  if (group === "doctor") {
    const required = ["AETHER_BASE_URL", "AETHER_TENANT_ID", "AETHER_PRINCIPAL_ID"];
    let sehat = true;
    for (const key of required) {
      const value = env[key];
      const ada = typeof value === "string" && value.length > 0;
      out(`${ada ? "✓" : "✗"} ${key}`);
      if (!ada) sehat = false;
    }
    return sehat ? 0 : 1;
  }

  if (options.client === undefined) {
    out("CLI memerlukan client. Set AETHER_BASE_URL, AETHER_TENANT_ID, dan AETHER_PRINCIPAL_ID.");
    return 1;
  }
  const client = options.client;

  if (group === "capabilities" && action === "list") {
    for (const capability of await client.capabilities.list()) {
      out(`${capability.id}\t${capability.version ?? "-"}`);
    }
    return 0;
  }

  if (group === "agents" && action === "list") {
    for (const agent of await client.agents.list()) {
      out(`${agent.id}\t${agent.version ?? "-"}\t${agent.name ?? "-"}`);
    }
    return 0;
  }

  if (group === "skills" && action === "list") {
    for (const skill of await client.skills.list()) {
      out(`${skill.id}\t${skill.name ?? "-"}`);
    }
    return 0;
  }

  if (group === "executions" && action === "inspect") {
    if (arg === undefined) {
      out("Usage: aether executions inspect <id>");
      return 1;
    }
    const run = await client.agents.getRun(arg);
    out(`${run.id}\t${run.state}\t${run.approvalId ?? "-"}`);
    return 0;
  }

  out(`Perintah tidak dikenal: ${argv.join(" ")}`);
  out(PENGGUNAAN);
  return 1;
}
