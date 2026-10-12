import {
    BespokeConfigError,
    type BespokeAuthoredConfig,
    type BespokeConfigField,
    type BespokeConfigSpec,
} from "../shared/bespokeComponentTypes.js"
import { EMBED_CONFIG_SPEC, type EmbedConfig } from "../shared/embedConfig.js"

export type ConfigFromSpec<Spec extends BespokeConfigSpec> = {
    [Key in keyof Spec]: Spec[Key] extends { default: string }
        ? FieldValue<Spec[Key]>
        : FieldValue<Spec[Key]> | undefined
}

type FieldValue<Field> = Field extends { type: "string" }
    ? string
    : Field extends { type: "number" | "integer" }
      ? number
      : Field extends { type: "boolean" }
        ? boolean
        : Field extends { type: "enum"; values: readonly (infer Value)[] }
          ? Value
          : Field extends {
                  type: "custom"
                  parse: (value: string) => infer Parsed
              }
            ? Parsed
            : never

export function parseConfigFromSpec<Spec extends BespokeConfigSpec>(
    spec: Spec,
    authoredConfig: BespokeAuthoredConfig
): ConfigFromSpec<Spec> & EmbedConfig {
    return {
        ...parseFields(spec, authoredConfig),
        ...parseFields(EMBED_CONFIG_SPEC, authoredConfig),
    }
}

function parseFields<Spec extends BespokeConfigSpec>(
    spec: Spec,
    authoredConfig: BespokeAuthoredConfig
): ConfigFromSpec<Spec> {
    return Object.fromEntries(
        Object.entries(spec).map(([key, field]) => [
            key,
            parseField(key, field, authoredConfig[key]),
        ])
    ) as ConfigFromSpec<Spec>
}

function parseField(
    key: string,
    field: BespokeConfigField,
    authoredValue: string | undefined
): unknown {
    const value = authoredValue?.trim() || undefined
    if (field.type === "custom")
        return value === undefined ? undefined : parseCustom(key, field, value)
    const fallback = parseDefault(key, field)
    return value === undefined ? fallback : parseFieldValue(key, field, value)
}

function parseDefault(
    key: string,
    field: Exclude<BespokeConfigField, { type: "custom" }>
): string | number | boolean | undefined {
    if (field.default === undefined) return undefined
    const value = field.default.trim()
    if (value === "") throw invalidDefaultError(key, field)
    try {
        return parseFieldValue(key, field, value)
    } catch (error) {
        if (!(error instanceof BespokeConfigError)) throw error
        throw invalidDefaultError(key, field, error)
    }
}

function invalidDefaultError(
    key: string,
    field: Exclude<BespokeConfigField, { type: "custom" }>,
    cause?: BespokeConfigError
): Error {
    return new Error(
        `Bespoke config key "${key}" has a default that is not a valid ${field.type}: "${field.default}"`,
        { cause }
    )
}

function parseFieldValue(
    key: string,
    field: Exclude<BespokeConfigField, { type: "custom" }>,
    value: string
): string | number | boolean {
    switch (field.type) {
        case "string":
            return value
        case "number":
            return parseNumber(key, value)
        case "integer":
            return parseInteger(key, value)
        case "boolean":
            return parseBoolean(key, value)
        case "enum":
            return parseEnum(key, value, field.values)
    }
}

function parseNumber(key: string, value: string): number {
    const n = Number(value)
    if (!Number.isFinite(n)) throw invalidValueError(key, value, "a number")
    return n
}

function parseInteger(key: string, value: string): number {
    const n = Number(value)
    if (!Number.isInteger(n))
        throw invalidValueError(key, value, "a whole number")
    return n
}

function parseBoolean(key: string, value: string): boolean {
    if (value === "true") return true
    if (value === "false") return false
    throw invalidValueError(key, value, '"true" or "false"')
}

function parseEnum<T extends string>(
    key: string,
    value: string,
    allowed: readonly T[]
): T {
    if (!(allowed as readonly string[]).includes(value))
        throw invalidValueError(
            key,
            value,
            `one of ${allowed.map((v) => `"${v}"`).join(", ")}`
        )
    return value as T
}

function parseCustom(
    key: string,
    field: Extract<BespokeConfigField, { type: "custom" }>,
    value: string
): unknown {
    try {
        return field.parse(value)
    } catch {
        throw invalidValueError(key, value, field.format)
    }
}

function invalidValueError(
    key: string,
    value: string,
    expected: string
): BespokeConfigError {
    return new BespokeConfigError(
        `${key}: "${value}" is not valid. Expected: ${expected}`
    )
}
