import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Strategy } from "./strategy.js";

type StrategyConstructor = new (...args: unknown[]) => Strategy;

export class StrategyLoader {
  private readonly strategies = new Map<string, Strategy>();

  static async create(defaultAmount: number): Promise<StrategyLoader> {
    const loader = new StrategyLoader();
    await loader.load(defaultAmount);
    return loader;
  }

  list(): string[] {
    return [...this.strategies.keys()];
  }

  get(name: string): Strategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${name}`);
    }
    return strategy;
  }

  private async load(defaultAmount: number): Promise<void> {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const modulesDir = join(currentDir, "modules");
    const entries = await readdir(modulesDir, { withFileTypes: true });
    const files = entries.filter(
      (entry) => entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".ts"))
    );

    for (const file of files) {
      const mod = await import(pathToFileURL(join(modulesDir, file.name)).href);
      for (const exported of Object.values(mod) as unknown[]) {
        if (typeof exported !== "function") {
          continue;
        }
        const StrategyCtor = exported as StrategyConstructor;
        try {
          const instance = new StrategyCtor(defaultAmount);
          if (typeof instance.name === "string" && typeof instance.nextAction === "function") {
            this.strategies.set(instance.name, instance);
          }
        } catch {
          // Skip classes that don't match the expected constructor signature.
        }
      }
    }

    if (this.strategies.size === 0) {
      throw new Error("No strategy modules were loaded.");
    }
  }
}
