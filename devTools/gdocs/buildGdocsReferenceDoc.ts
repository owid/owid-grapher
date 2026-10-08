/*
 * Publishes the gdocs writing reference — the three committed registries
 * (components, templates, guides) — as a library of Google Docs: one index
 * plus one document per component, template and guide, in the Drive folder
 * GDOCS_REFERENCE_FOLDER_ID. Each document is built as Markdown and uploaded
 * to its Google Doc, which Drive converts. The production admin deploy runs
 * it on every master deploy (ops repo,
 * templates/owid-admin-prod/admin-refresh.sh); see
 * docs/gdocs-writing-reference.md.
 *
 *   yarn buildGdocsReferenceDoc                 write the library into GDOCS_REFERENCE_FOLDER_ID
 *   yarn buildGdocsReferenceDoc --dry-run       print the Markdown of every document, no Google calls
 *   yarn buildGdocsReferenceDoc --dry-run --out <dir>
 *                                               one Markdown file per document in <dir>
 */

import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import parseArgs from "minimist"
import type {
    ComponentRegistry,
    GuideReference,
    TemplateReference,
} from "@ourworldindata/types"
import componentsRegistry from "@ourworldindata/types/src/gdocTypes/components.registry.generated.json"
import templatesRegistry from "@ourworldindata/types/src/gdocTypes/templates.registry.generated.json"
import guidesRegistry from "@ourworldindata/types/src/gdocTypes/guides.registry.generated.json"
import {
    buildReferenceLibrary,
    type ReferenceRegistries,
} from "./referenceDoc/buildModel.js"
import type { ReferenceLibrary } from "./referenceDoc/model.js"
import {
    renderLibraryMarkdown,
    renderLibraryMarkdownAsOne,
} from "./referenceDoc/renderMarkdown.js"

const SETTING_NAME = "GDOCS_REFERENCE_FOLDER_ID"

function printHelp(): void {
    console.log(`Publish the gdocs writing reference as a library of Google Docs.

Usage:
    yarn buildGdocsReferenceDoc
    yarn buildGdocsReferenceDoc --dry-run [--out <dir>]

Options:
    --dry-run       Print the Markdown every document would be uploaded with,
                    without calling Google.
    --out <dir>     With --dry-run, write one file per document into <dir>
                    (index.md, component-chart.md, …) instead of printing to
                    stdout.
    -h, --help      Show this help.

The documents live in the Drive folder ${SETTING_NAME} (.env), shared with
the service account (GDOCS_CLIENT_EMAIL) as an editor.`)
}

const registries: ReferenceRegistries = {
    components: (componentsRegistry as ComponentRegistry).components,
    templates: templatesRegistry as TemplateReference[],
    guides: guidesRegistry as GuideReference[],
}

function currentCommitSha(): string {
    const fromCi = process.env.GITHUB_SHA
    if (fromCi) return fromCi.slice(0, 7)
    try {
        return execSync("git rev-parse --short HEAD", {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim()
    } catch {
        return "unknown"
    }
}

function dryRun(library: ReferenceLibrary, args: parseArgs.ParsedArgs): void {
    const outDir: string | undefined = args.out
    if (outDir)
        for (const file of renderLibraryMarkdown(library))
            writeOut(outDir, file.fileName, file.markdown)
    else process.stdout.write(renderLibraryMarkdownAsOne(library))
}

function writeOut(dir: string, fileName: string, content: string): void {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, fileName), content)
}

async function main(args: parseArgs.ParsedArgs): Promise<void> {
    if (!args["dry-run"] && args.out !== undefined) {
        console.error("--out only applies with --dry-run")
        process.exit(1)
    }
    const generatedAt = new Date()
    const commitSha = currentCommitSha()

    if (args["dry-run"]) {
        // No documents exist, so nothing links anywhere
        const library = buildReferenceLibrary(registries, {
            generatedAt,
            commitSha,
            urlFor: () => undefined,
        })
        dryRun(library, args)
        return
    }

    // Loaded here so --dry-run needs neither .env settings nor Google auth
    const { GDOCS_REFERENCE_FOLDER_ID } =
        await import("../../settings/serverSettings.js")
    if (!GDOCS_REFERENCE_FOLDER_ID) {
        console.error(
            `${SETTING_NAME} is not set. Create the Drive folder by hand, share it with the service account as an editor, and put its id in .env.`
        )
        process.exit(1)
    }
    const { publishReferenceLibrary } =
        await import("./referenceDoc/publish.js")
    const result = await publishReferenceLibrary(registries, {
        folderId: GDOCS_REFERENCE_FOLDER_ID,
        generatedAt,
        commitSha,
        log: (message) => console.error(message),
    })
    console.error(`Index: ${result.indexUrl}`)
}

const args = parseArgs(process.argv.slice(2), {
    boolean: ["dry-run", "help"],
    string: ["out"],
    alias: { h: "help" },
})

if (args.help) printHelp()
else
    main(args).catch((error) => {
        console.error(error)
        process.exit(1)
    })
