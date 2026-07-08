import type * as v1 from "./v1";

export type VersionModule = typeof v1;

const modules: Record<string, () => Promise<VersionModule>> = {
  v1: () => import("./v1"),
};

export async function resolveVersion(id: string): Promise<VersionModule> {
  const loader = modules[id];
  if (!loader) throw new Error(`Unknown judgment version: ${id}`);
  return loader();
}

export function registerVersion(id: string, loader: () => Promise<VersionModule>): void {
  modules[id] = loader;
}
