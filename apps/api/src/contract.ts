import { readFileSync } from 'node:fs';

type JsonSchema = Record<string, unknown>;
type Parameter = { name: string; in: 'query' | 'path' | 'header'; required?: boolean; schema: JsonSchema };
type Operation = {
  parameters?: Parameter[];
  responses: Record<string, { content?: Record<string, { schema: JsonSchema }> }>;
};
export type Contract = {
  info: { version: string };
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, JsonSchema> };
};

export const contract: Contract = JSON.parse(
  readFileSync(new URL('../../../contracts/openapi.json', import.meta.url), 'utf8')
);

const componentPrefix = '#/components/schemas/';

function rewriteRefs<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, v) =>
    key === '$ref' && typeof v === 'string' && v.startsWith(componentPrefix) ? `${v.slice(componentPrefix.length)}#` : v
  );
}

export function componentSchemas(): JsonSchema[] {
  return Object.entries(contract.components.schemas).map(([name, schema]) => ({ $id: name, ...rewriteRefs(schema) }));
}

export const toFastifyPath = (path: string) => path.replace(/\{(\w+)\}/g, ':$1');
const toContractPath = (path: string) => path.replace(/:(\w+)/g, '{$1}');

export function requiresBearer(methods: string | string[], fastifyPath: string): boolean {
  return [methods].flat().some((method) => {
    const verb = method.toLowerCase() === 'head' ? 'get' : method.toLowerCase();
    const security = (contract.paths[toContractPath(fastifyPath)]?.[verb] as { security?: Record<string, unknown>[] } | undefined)?.security;
    return security?.some((requirement) => 'BearerAuth' in requirement) ?? false;
  });
}

function operation(method: string, path: string): Operation {
  const op = contract.paths[path]?.[method];
  if (!op) throw new Error(`Operation ${method.toUpperCase()} ${path} is not in the contract`);
  return op;
}

function parameterSchema(op: Operation, location: Parameter['in'], overrides: Record<string, JsonSchema>) {
  const params = (op.parameters ?? []).filter((p) => p.in === location);
  if (params.length === 0) return undefined;
  return {
    type: 'object',
    required: params.filter((p) => p.required).map((p) => p.name),
    properties: Object.fromEntries(params.map((p) => [p.name, { ...p.schema, ...overrides[p.name] }]))
  };
}

export function routeSchema(method: string, path: string, overrides: Record<string, JsonSchema> = {}) {
  const op = operation(method, path);
  const response = Object.fromEntries(
    Object.entries(op.responses).flatMap(([status, r]) => {
      const schema = r.content?.['application/json']?.schema;
      return schema ? [[status, rewriteRefs(schema)]] : [];
    })
  );
  const querystring = parameterSchema(op, 'query', overrides);
  const params = parameterSchema(op, 'path', overrides);
  return { response, ...(querystring ? { querystring } : {}), ...(params ? { params } : {}) };
}
