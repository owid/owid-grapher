#! /usr/bin/env node

import parseArgs from "minimist"
import fs from "fs-extra"
import { range } from "lodash"

const TEMPLATE_FILENAME = "./devTools/schema/template"

const schemaVersionRegex =
    /https:\/\/files\.ourworldindata\.org\/schemas\/grapher-schema\.(?<version>\d{3})\.json/m
const getSchemaVersion = (config: Record<string, any>): string =>
    config.$schema?.match(schemaVersionRegex)?.groups?.version ?? "000"

const toArrayString = (arr: string[]) =>
    `[${arr.map((v) => `"${v}"`).join(", ")}]`

function generateDefaultObjectFromSchema(
    schema: Record<string, any>,
    defs: Record<string, any> = {}
) {
    const defaultObject: Record<string, any> = {}
    if (schema.type === "object") {
        for (const key in schema.properties) {
            // substitute $ref with the actual definition
            const ref = schema.properties[key].$ref
            // FIXME: Not sure whether != is necessary here.
            // eslint-disable-next-line eqeqeq
            if (ref != undefined) {
                const regex = /#\/\$defs\/([a-zA-Z]+)/
                const [_, defKey] = ref.match(regex) ?? []
                const def = defs[defKey]
                // FIXME: Not sure whether == is necessary here.
                // eslint-disable-next-line eqeqeq
                if (def == undefined)
                    throw new Error(`Definition "${ref}" not found`)
                schema.properties[key] = def
            }

            if (schema.properties[key].type === "object") {
                const defaults = generateDefaultObjectFromSchema(
                    schema.properties[key],
                    defs
                )
                if (Object.keys(defaults).length) defaultObject[key] = defaults
                // FIXME: Not sure whether != is necessary here.
                // eslint-disable-next-line eqeqeq
            } else if (schema.properties[key].default != undefined) {
                defaultObject[key] = schema.properties[key].default
            }
        }
    }
    return defaultObject
}

async function main(parsedArgs: parseArgs.ParsedArgs) {
    const schemaFilename = parsedArgs._[0]
    // FIXME: Not sure whether == is necessary here.
    // eslint-disable-next-line eqeqeq
    if (schemaFilename == undefined) {
        help()
        process.exit(0)
    }

    const schema = fs.readJSONSync(schemaFilename)
    const defs = schema.$defs || {}
    const defaultConfig = generateDefaultObjectFromSchema(schema, defs)
    const defaultConfigJSON = JSON.stringify(defaultConfig, undefined, 2)

    // save as ts file if requested
    if (parsedArgs["save-ts"]) {
        const template = fs.readFileSync(TEMPLATE_FILENAME, "utf8")

        const latestVersion = getSchemaVersion(defaultConfig)
        const outdatedVersionsAsInts = range(1, parseInt(latestVersion))
        const outdatedVersions = outdatedVersionsAsInts.map((versionNumber) =>
            versionNumber.toString().padStart(3, "0")
        )

        const out = parsedArgs["save-ts"]
        const content = template
            .replace("{{LATEST_SCHEMA_VERSION}}", latestVersion.toString())
            .replace(
                "{{OUTDATED_SCHEMA_VERSIONS}}",
                toArrayString(outdatedVersions)
            )
            .replace("{{DEFAULT_GRAPHER_CONFIG}}", defaultConfigJSON)

        fs.outputFileSync(out, content)
    }

    // write json to stdout
    process.stdout.write(defaultConfigJSON)
}

function help() {
    console.log(`generate-default-object-from-schema.ts - utility to generate an object with all default values that are given in a JSON schema

Usage:
  generate-default-object-from-schema.js --save-ts <out.ts> <schema.json>`)
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"] || parsedArgs["help"]) {
    help()
    process.exit(0)
} else {
    void main(parsedArgs)
}
