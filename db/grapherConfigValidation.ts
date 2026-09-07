import * as _ from "lodash-es"
import Ajv, { ErrorObject, ValidateFunction } from "ajv"
import addFormats from "ajv-formats"
import { GrapherInterface, JsonError } from "@ourworldindata/types"
import {
    AnyConfig,
    defaultGrapherConfig,
    getSchemaVersion,
    latestGrapherPatchSchema,
    latestGrapherSchema,
    migrateGrapherConfigToLatestVersion,
} from "@ourworldindata/grapher"

export type GrapherConfigKind = "chart" | "patch"

export interface GrapherConfigValidationIssue {
    pointer: string
    message: string
    /** The chart this issue belongs to */
    label?: string
}

const ajv = new Ajv({ allErrors: true, strict: true })
addFormats(ajv)
const VALIDATORS: Record<GrapherConfigKind, ValidateFunction> = {
    chart: ajv.compile(latestGrapherSchema),
    patch: ajv.compile(latestGrapherPatchSchema),
}

export function validateGrapherConfig(
    config: AnyConfig,
    kind: GrapherConfigKind
): GrapherConfigValidationIssue[] {
    const validate = VALIDATORS[kind]
    if (validate(config)) return []
    return (validate.errors ?? []).map((error) => ({
        pointer: pointerForError(error),
        message: error.message ?? `must satisfy ${error.keyword}`,
    }))
}

export class GrapherConfigValidationError extends JsonError {
    constructor(
        kind: GrapherConfigKind,
        public readonly issues: GrapherConfigValidationIssue[],
        checkedCount?: number
    ) {
        super(buildValidationErrorMessage(kind, issues, checkedCount), 400)
    }
}

/** Throws if the config is invalid, reporting every issue at once */
export function assertValidGrapherConfig(
    config: AnyConfig,
    kind: GrapherConfigKind
): void {
    const issues = validateGrapherConfig(config, kind)
    if (issues.length > 0) throw new GrapherConfigValidationError(kind, issues)
}

/** Throws once if any config is invalid, naming every one that failed */
export function assertValidGrapherConfigs(
    configs: readonly { label: string; config: AnyConfig }[],
    kind: GrapherConfigKind
): void {
    const issues = configs.flatMap(({ label, config }) =>
        validateGrapherConfig(config, kind).map((issue) => ({
            ...issue,
            label,
        }))
    )
    if (issues.length > 0)
        throw new GrapherConfigValidationError(kind, issues, configs.length)
}

export function ingestGrapherConfig(
    config: AnyConfig,
    kind: GrapherConfigKind
): GrapherInterface {
    if (!_.isPlainObject(config))
        throw new GrapherConfigValidationError(kind, [
            { pointer: "", message: "must be object" },
        ])

    // rejected before migrating, which reports an unknown version as a stale reader
    const version = getSchemaVersion(config)
    if (version === null)
        throw new GrapherConfigValidationError(kind, [
            {
                pointer: "/$schema",
                message:
                    config.$schema === undefined
                        ? `must have a $schema; expected ${defaultGrapherConfig.$schema}`
                        : `unknown schema version ${config.$schema}; expected ${defaultGrapherConfig.$schema}`,
            },
        ])

    const migrated = migrateGrapherConfigToLatestVersion(config)
    const issues = validateGrapherConfig(migrated, kind)
    if (issues.length > 0) throw new GrapherConfigValidationError(kind, issues)
    return migrated
}

function pointerForError(error: ErrorObject): string {
    // ajv reports additionalProperties at the parent instance path, with the offending key in params
    if (error.keyword === "additionalProperties")
        return `${error.instancePath}/${error.params.additionalProperty}`
    return error.instancePath
}

function buildValidationErrorMessage(
    kind: GrapherConfigKind,
    issues: GrapherConfigValidationIssue[],
    checkedCount?: number
): string {
    const labels = _.uniq(
        issues
            .map((issue) => issue.label)
            .filter((label) => label !== undefined)
    )
    if (labels.length === 0) {
        const lines = issues.map(
            (issue) => `  ${issue.pointer || "(root)"}: ${issue.message}`
        )
        return [`Invalid grapher ${kind} config:`, ...lines].join("\n")
    }

    const lines = labels.flatMap((label) => [
        `  ${label}`,
        ...issues
            .filter((issue) => issue.label === label)
            .map(
                (issue) => `    ${issue.pointer || "(root)"}: ${issue.message}`
            ),
    ])
    return [
        `Invalid grapher ${kind} config for ${labels.length} of ${checkedCount} charts:`,
        ...lines,
    ].join("\n")
}
