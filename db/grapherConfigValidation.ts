import fs from "fs"
import path from "path"
import * as _ from "lodash-es"
import Ajv, { ErrorObject } from "ajv"
import addFormats from "ajv-formats"
import type { JSONSchema7 } from "json-schema"
import { parse } from "yaml"
import { GrapherInterface, JsonError } from "@ourworldindata/types"
import {
    AnyConfig,
    defaultGrapherConfig,
    getSchemaVersion,
    latestSchemaVersion,
    migrateGrapherConfigToLatestVersion,
} from "@ourworldindata/grapher"
import findProjectBaseDir from "../settings/findBaseDir.mjs"

export interface GrapherConfigValidationIssue {
    pointer: string
    message: string
    /** The chart this issue belongs to */
    label?: string
}

const ajv = new Ajv({ allErrors: true, strict: true })
addFormats(ajv)
const validateAgainstSchema = ajv.compile(readLatestGrapherSchema())

export class GrapherConfigValidationError extends JsonError {
    constructor(
        public readonly issues: GrapherConfigValidationIssue[],
        checkedCount?: number
    ) {
        super(buildValidationErrorMessage(issues, checkedCount), 400)
    }
}

export function validateGrapherConfig(
    config: AnyConfig
): GrapherConfigValidationIssue[] {
    if (validateAgainstSchema(config)) return []
    return (validateAgainstSchema.errors ?? []).map((error) => ({
        pointer: pointerForError(error),
        message: error.message ?? `must satisfy ${error.keyword}`,
    }))
}

/** Throws if the config is invalid, reporting every issue at once */
export function assertValidGrapherConfig(config: AnyConfig): void {
    const issues = validateGrapherConfig(config)
    if (issues.length > 0) throw new GrapherConfigValidationError(issues)
}

/** Throws once if any config is invalid, naming every one that failed */
export function assertValidGrapherConfigs(
    configs: readonly { label: string; config: AnyConfig }[]
): void {
    const issues = configs.flatMap(({ label, config }) =>
        validateGrapherConfig(config).map((issue) => ({
            ...issue,
            label,
        }))
    )
    if (issues.length > 0)
        throw new GrapherConfigValidationError(issues, configs.length)
}

export function ingestGrapherConfig(config: AnyConfig): GrapherInterface {
    if (!_.isPlainObject(config))
        throw new GrapherConfigValidationError([
            { pointer: "", message: "must be object" },
        ])

    // rejected before migrating, which reports an unknown version as a stale reader
    const version = getSchemaVersion(config)
    if (version === null)
        throw new GrapherConfigValidationError([
            {
                pointer: "/$schema",
                message:
                    config.$schema === undefined
                        ? `must have a $schema; expected ${defaultGrapherConfig.$schema}`
                        : `unknown schema version ${config.$schema}; expected ${defaultGrapherConfig.$schema}`,
            },
        ])

    const migrated = migrateGrapherConfigToLatestVersion(config)
    const issues = validateGrapherConfig(migrated)
    if (issues.length > 0) throw new GrapherConfigValidationError(issues)
    return migrated
}

function readLatestGrapherSchema(): JSONSchema7 {
    const baseDir = findProjectBaseDir(__dirname)
    if (baseDir === undefined)
        throw new Error("Could not find the owid-grapher base directory")
    const filePath = path.join(
        baseDir,
        "packages/@ourworldindata/grapher/src/schema",
        `grapher-schema.${latestSchemaVersion}.yaml`
    )
    return parse(fs.readFileSync(filePath, "utf8")) as JSONSchema7
}

function pointerForError(error: ErrorObject): string {
    // ajv reports additionalProperties at the parent instance path, with the offending key in params
    if (error.keyword === "additionalProperties")
        return `${error.instancePath}/${error.params.additionalProperty}`
    return error.instancePath
}

function buildValidationErrorMessage(
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
        return ["Invalid grapher config:", ...lines].join("\n")
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
        `Invalid grapher config for ${labels.length} of ${checkedCount} charts:`,
        ...lines,
    ].join("\n")
}
