declare module "bun:test" {
  type TestCallback = () => void | Promise<void>;
  type Matcher = {
    not: Matcher;
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toHaveLength: (expected: number) => void;
    toBeGreaterThan: (expected: number) => void;
    toBeGreaterThanOrEqual: (expected: number) => void;
    toBeLessThan: (expected: number) => void;
    toBeLessThanOrEqual: (expected: number) => void;
    toContain: (expected: unknown) => void;
    toMatchObject: (expected: unknown) => void;
    toBeNull: () => void;
    toBeDefined: () => void;
    toBeUndefined: () => void;
    toBeInstanceOf: (expected: unknown) => void;
    toThrow: (expected?: unknown) => void;
  };

  export const describe: (name: string, callback: TestCallback) => void;
  export const test: (name: string, callback: TestCallback) => void;
  export const it: (name: string, callback: TestCallback) => void;
  export const expect: (actual: unknown) => Matcher;
}
