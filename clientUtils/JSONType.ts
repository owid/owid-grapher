export type JSONPrimitive = string | number | boolean | null
export type JSONType = JSONPrimitive | JSONType[] | { [key: string]: JSONType }
