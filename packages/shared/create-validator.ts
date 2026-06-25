import type { Static, TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

export type Validator<T extends TSchema> = {
  parse(value: unknown): Static<T>;
  check(value: unknown): value is Static<T>;
};

export function createValidator<T extends TSchema>(schema: T, label: string): Validator<T> {
  const compiled = TypeCompiler.Compile(schema);
  return {
    parse(value: unknown): Static<T> {
      if (compiled.Check(value)) return value as Static<T>;
      throw new Error(`${label} validation failed: ${validationErrors(compiled.Errors(value))}`);
    },
    check(value: unknown): value is Static<T> {
      return compiled.Check(value);
    },
  };
}

function validationErrors(errors: Iterable<{ path: string; message: string }>): string {
  const out: string[] = [];
  for (const error of errors) {
    const path = error.path.length === 0 ? "/" : error.path;
    out.push(`${path} ${error.message}`);
    if (out.length >= 3) break;
  }
  return out.length === 0 ? "unknown schema mismatch" : out.join("; ");
}

