import fs from "fs"
import path from "path"
import * as _ from "lodash-es"
import Ajv, { ErrorObject } from "ajv"
import addFormats from "ajv-formats"
import type { JSONSchema7 } from "json-schema"
import { parse } from "yaml"
import { GrapherInterface, JsonError } from "@ourworldindata/types"
import {
    UntypedGrapherConfig,
    defaultGrapherConfig,
    getSchemaVersion,
    latestSchemaVersion,
    migrateGrapherConfigToLatestVersion,
} from "@ourworldindata/grapher"
import findProjectBaseDir from "../settings/findBaseDir.mjs"

export interface GrapherConfigValidationIssue {
    pointer: string
    message: string
}

export type GrapherConfigIngestResult =
    | { isValid: true; config: GrapherInterface }
    | { isValid: false; issues: GrapherConfigValidationIssue[] }

const ajv = new Ajv({ allErrors: true, strict: true })
addFormats(ajv)
const validateAgainstSchema = ajv.compile(readLatestGrapherSchema())

export class GrapherConfigValidationError extends JsonError {
    constructor(public readonly issues: GrapherConfigValidationIssue[]) {
        super(formatGrapherConfigIssues(issues), 400)
    }
}

/** Throws if the config is invalid, reporting every issue at once */
export function assertValidGrapherConfig(config: UntypedGrapherConfig): void {
    const issues = validateGrapherConfig(config)
    if (issues.length > 0) throw new GrapherConfigValidationError(issues)
}

/** Migrates a config to the latest schema and validates it */
export function tryIngestGrapherConfig(
    config: unknown
): GrapherConfigIngestResult {
    if (!isPlainObjectConfig(config))
        return {
            isValid: false,
            issues: [{ pointer: "", message: "must be object" }],
        }

    // rejected before migrating, which reports an unknown version as a stale reader
    const version = getSchemaVersion(config)
    if (version === null)
        return {
            isValid: false,
            issues: [
                {
                    pointer: "/$schema",
                    message:
                        config.$schema === undefined
                            ? `must have a $schema; expected ${defaultGrapherConfig.$schema}`
                            : `unknown schema version ${config.$schema}; expected ${defaultGrapherConfig.$schema}`,
                },
            ],
        }

    let migrated: GrapherInterface
    try {
        migrated = migrateGrapherConfigToLatestVersion(config)
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return {
            isValid: false,
            issues: [
                {
                    pointer: "",
                    message: `could not be migrated from schema version ${version}: ${reason}`,
                },
            ],
        }
    }

    migrated.$schema = defaultGrapherConfig.$schema

    const issues = validateGrapherConfig(migrated)
    if (issues.length > 0) return { isValid: false, issues }
    return { isValid: true, config: migrated }
}

/** Migrates a config to the latest schema and validates it, throwing on rejection */
export function ingestGrapherConfig(
    config: UntypedGrapherConfig
): GrapherInterface {
    const ingestResult = tryIngestGrapherConfig(config)
    if (!ingestResult.isValid)
        throw new GrapherConfigValidationError(ingestResult.issues)
    return ingestResult.config
}

function isPlainObjectConfig(value: unknown): value is UntypedGrapherConfig {
    return _.isPlainObject(value)
}

function validateGrapherConfig(
    config: UntypedGrapherConfig
): GrapherConfigValidationIssue[] {
    if (validateAgainstSchema(config)) return []
    return (validateAgainstSchema.errors ?? []).map((error) => ({
        pointer: pointerForError(error),
        message: error.message ?? `must satisfy ${error.keyword}`,
    }))
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

export function formatGrapherConfigIssues(
    issues: GrapherConfigValidationIssue[]
): string {
    const lines = issues.map(
        (issue) => `  ${issue.pointer || "(root)"}: ${issue.message}`
    )
    return ["Invalid grapher config:", ...lines].join("\n")
}
