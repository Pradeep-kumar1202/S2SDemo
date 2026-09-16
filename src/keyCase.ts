type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const snakeToCamel = (key: string) =>
  key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const camelToSnake = (key: string) =>
  key.replace(/([A-Z])/g, c => `_${c.toLowerCase()}`);

function transformKeys(value: Json, fn: (key: string) => string): Json {
  if (Array.isArray(value)) {
    return value.map(v => transformKeys(v, fn));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [fn(k), transformKeys(v, fn)]),
    );
  }
  return value;
}

/** Deeply renames snake_case keys to camelCase (Hyperswitch -> Google Pay format). */
export const toCamelCaseKeys = <T = any>(value: unknown): T =>
  transformKeys(value as Json, snakeToCamel) as T;

/** Deeply renames camelCase keys to snake_case (Google Pay -> Hyperswitch format). */
export const toSnakeCaseKeys = <T = any>(value: unknown): T =>
  transformKeys(value as Json, camelToSnake) as T;
