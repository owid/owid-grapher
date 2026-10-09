import type {
    BespokeAuthoredConfig,
    BespokeComponentDataUrls,
    BespokeConfigField,
    BespokeConfigSpec,
} from "../shared/bespokeComponentTypes.js"
import type { EmbedConfig } from "../shared/embedConfig.js"

export interface VariantProps<Config> {
    config: Config & EmbedConfig
    urls: BespokeComponentDataUrls
}

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
): ConfigFromSpec<Spec> {
    return Object.fromEntries(
        Object.entries(spec).map(([key, field]) => [
            key,
            parseField(key, field, authoredConfig[key]),
        ])
    ) as ConfigFromSpec<Spec>
}

export function parseEmbedConfig(
    authoredConfig: BespokeAuthoredConfig
): EmbedConfig {
    return {
        urlSync: parseBoolean(authoredConfig.urlSync) ?? false,
        hideMetadataModal:
            parseBoolean(authoredConfig.hideMetadataModal) ?? false,
    }
}

function parseField(
    key: string,
    field: BespokeConfigField,
    authoredValue?: string
): unknown {
    const value = authoredValue?.trim() || undefined
    if (field.type === "custom")
        return value === undefined ? undefined : field.parse(value)
    const fallback = parseDefault(key, field)
    return parseFieldValue(field, value) ?? fallback
}

function parseDefault(
    key: string,
    field: Exclude<BespokeConfigField, { type: "custom" }>
): string | number | boolean | undefined {
    if (field.default === undefined) return undefined
    const parsed = parseFieldValue(field, field.default)
    if (parsed === undefined)
        throw new Error(
            `Bespoke config key "${key}" has a default that is not a valid ${field.type}: "${field.default}"`
        )
    return parsed
}

function parseFieldValue(
    field: Exclude<BespokeConfigField, { type: "custom" }>,
    value: string | undefined
): string | number | boolean | undefined {
    switch (field.type) {
        case "string":
            return value
        case "number":
            return parseNumber(value)
        case "integer":
            return parseInteger(value)
        case "boolean":
            return parseBoolean(value)
        case "enum":
            return parseEnum(value, field.values)
    }
}

export function parseNumber(value: unknown): number | undefined {
    if (typeof value !== "string" && typeof value !== "number") return undefined
    const n = typeof value === "string" ? Number(value) : value
    return Number.isFinite(n) ? n : undefined
}

export function parseInteger(value: unknown): number | undefined {
    const n = parseNumber(value)
    return n === undefined ? undefined : Math.round(n)
}

export function parseBoolean(value: unknown): boolean | undefined {
    if (value === "true") return true
    if (value === "false") return false
    return undefined
}

export function parseEnum<T extends string>(
    value: unknown,
    allowed: readonly T[]
): T | undefined {
    if (typeof value !== "string") return undefined
    return (allowed as readonly string[]).includes(value)
        ? (value as T)
        : undefined
}
