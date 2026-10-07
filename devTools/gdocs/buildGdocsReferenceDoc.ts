/*
 * Publishes the gdocs writing reference — the three committed registries
 * (components, templates, guides) — as a Google Doc, one tab per section.
 * The production admin deploy runs it on every master deploy (ops repo,
 * templates/owid-admin-prod/admin-refresh.sh); see docs/gdocs-writing-reference.md.
 *
 *   yarn buildGdocsReferenceDoc                 write the doc in GDOCS_REFERENCE_DOCUMENT_ID
 *   yarn buildGdocsReferenceDoc --single-tab    everything into the first tab, sections as H1
 *   yarn buildGdocsReferenceDoc --dry-run       print the document as Markdown, no Google calls
 *   yarn buildGdocsReferenceDoc --dry-run --requests
 *                                               print the pass-1 batchUpdate chunks as JSON
 *   --out <file>                                write the dry-run output to a file
 */

import { execSync } from "child_process"
import fs from "fs"
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
    buildReferenceDocument,
    flattenToSingleTab,
    type ReferenceRegistries,
} from "./referenceDoc/buildModel.js"
import type { ReferenceDocument } from "./referenceDoc/model.js"
import { renderMarkdown } from "./referenceDoc/renderMarkdown.js"
import {
    blocksToRequests,
    chunkRequests,
} from "./referenceDoc/renderDocsRequests.js"

const SETTING_NAME = "GDOCS_REFERENCE_DOCUMENT_ID"
const TAB_ID_PLACEHOLDER = "<tabId>"

function printHelp(): void {
    console.log(`Publish the gdocs writing reference as a Google Doc.

Usage:
    yarn buildGdocsReferenceDoc [--single-tab]
    yarn buildGdocsReferenceDoc --dry-run [--requests] [--out <file>] [--single-tab]

Options:
    --dry-run       Render without calling Google: Markdown, or with
                    --requests the pass-1 batchUpdate chunks as JSON.
    --requests      With --dry-run, emit the request chunks instead of Markdown.
    --out <file>    Write the dry-run output to a file instead of stdout.
    --single-tab    Write everything into the first tab, sections as H1.
    -h, --help      Show this help.

The target document is ${SETTING_NAME} in .env, shared with the service
account (GDOCS_CLIENT_EMAIL) as an editor.`)
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

function renderRequestsJson(doc: ReferenceDocument): string {
    const chunks = doc.sections.flatMap((section) =>
        chunkRequests(
            blocksToRequests(section.blocks, TAB_ID_PLACEHOLDER, 1).requests
        )
    )
    return JSON.stringify(chunks, null, 2)
}

async function main(args: parseArgs.ParsedArgs): Promise<void> {
    if (!args["dry-run"] && (args.requests || args.out !== undefined)) {
        console.error("--requests and --out only apply with --dry-run")
        process.exit(1)
    }
    let doc = buildReferenceDocument(registries, {
        generatedAt: new Date(),
        commitSha: currentCommitSha(),
    })
    if (args["single-tab"]) doc = flattenToSingleTab(doc)

    if (args["dry-run"]) {
        const output = args.requests
            ? renderRequestsJson(doc)
            : renderMarkdown(doc)
        if (args.out) fs.writeFileSync(args.out, output)
        else process.stdout.write(output)
        return
    }

    // Loaded here so --dry-run needs neither .env settings nor Google auth
    const { GDOCS_REFERENCE_DOCUMENT_ID } =
        await import("../../settings/serverSettings.js")
    if (!GDOCS_REFERENCE_DOCUMENT_ID) {
        console.error(
            `${SETTING_NAME} is not set. Create the Google Doc by hand, share it with the service account as an editor, and put its id in .env.`
        )
        process.exit(1)
    }
    const { publishReferenceDoc } = await import("./referenceDoc/publish.js")
    const result = await publishReferenceDoc(doc, {
        documentId: GDOCS_REFERENCE_DOCUMENT_ID,
        singleTab: !!args["single-tab"],
        log: (message) => console.error(message),
    })
    console.error(
        `Done: https://docs.google.com/document/d/${GDOCS_REFERENCE_DOCUMENT_ID} (tabs ${result.tabIds.join(", ")})`
    )
}

const args = parseArgs(process.argv.slice(2), {
    boolean: ["dry-run", "requests", "single-tab", "help"],
    string: ["out"],
    alias: { h: "help" },
})

if (args.help) printHelp()
else
    main(args).catch((error) => {
        console.error(error)
        process.exit(1)
    })
