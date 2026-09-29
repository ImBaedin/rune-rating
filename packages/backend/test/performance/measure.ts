import type { MutationCtx } from "../../convex/_generated/server";

export type Metrics = {
  reads: number;
  readBytes: number;
  writes: number;
  writeBytes: number;
  tables: Record<string, { reads: number; bytes: number }>;
};
export const newMetrics = (): Metrics => ({
  reads: 0,
  readBytes: 0,
  writes: 0,
  writeBytes: 0,
  tables: {},
});
const size = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;

// Measures application-visible JSON document bytes, not Convex billing/index/network overhead.
export function measuredContext(
  ctx: MutationCtx,
  metrics: Metrics,
): MutationCtx {
  function record(value: unknown, table: string) {
    const docs = Array.isArray(value) ? value : value ? [value] : [];
    for (const doc of docs) {
      const bytes = size(doc);
      metrics.reads++;
      metrics.readBytes += bytes;
      metrics.tables[table] ??= { reads: 0, bytes: 0 };
      const totals = metrics.tables[table];
      totals.reads++;
      totals.bytes += bytes;
    }
    return value;
  }
  function queryProxy(query: object, table: string): object {
    return new Proxy(query, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const result = Reflect.apply(value, target, args);
          if (["unique", "first", "take", "collect"].includes(String(key))) {
            return Promise.resolve(result).then((value) =>
              record(value, table),
            );
          }
          if (typeof result !== "object" || result === null)
            throw Error("Unexpected query result");
          return queryProxy(result, table);
        };
      },
    });
  }
  const db = new Proxy(ctx.db, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        if (key === "query")
          return queryProxy(
            Reflect.apply(value, target, args),
            String(args[0]),
          );
        if (key === "get")
          return Promise.resolve(Reflect.apply(value, target, args)).then(
            (doc) => record(doc, "get"),
          );
        if (["patch", "replace", "insert", "delete"].includes(String(key))) {
          metrics.writes++;
          metrics.writeBytes += size(args);
        }
        return Reflect.apply(value, target, args);
      };
    },
  });
  return { ...ctx, db };
}

// convex-test's registered function wrappers expose this test-only handler.
export function handler<A, R>(
  fn: unknown,
): (ctx: MutationCtx, args: A) => Promise<R> {
  return (fn as { _handler: (ctx: MutationCtx, args: A) => Promise<R> })
    ._handler;
}
