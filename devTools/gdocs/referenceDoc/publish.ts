/*
 * The Google side of `yarn buildGdocsReferenceDoc`: writes a rendered
 * ReferenceDocument into one fixed Google Doc, one tab per section.
 *
 * The document is created by hand once and shared with the service account
 * as an editor; this never creates documents or Drive files. Tabs are found
 * by title. On a fresh document the first (untitled) tab becomes the Overview
 * and the other sections are added after it; on a re-run every section tab
 * is cleared and refilled in place, so tab ids, order and the URL survive.
 * Tabs with other titles are left alone. With `singleTab`, only the first
 * tab is written (the caller flattens the model first).
 *
 * A failing batchUpdate stops the run with the chunk index and Google's
 * error; the document may then be half written, and the next run repairs it.
 */

import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import { OwidGoogleAuth } from "../../../db/OwidGoogleAuth.js"
import type { ReferenceDocument, Section } from "./model.js"
import {
    blocksToRequests,
    chunkRequests,
    fillTableRequests,
    locateTables,
    type PlannedTable,
} from "./renderDocsRequests.js"

type Request = docs_v1.Schema$Request

export interface PublishOptions {
    documentId: string
    singleTab?: boolean
    log?: (message: string) => void
    /** A Docs client to use instead of the service-account one (tests) */
    client?: docs_v1.Docs
}

export interface PublishResult {
    /** Tab id written for each section, in section order */
    tabIds: string[]
}

export async function publishReferenceDoc(
    doc: ReferenceDocument,
    options: PublishOptions
): Promise<PublishResult> {
    const log = options.log ?? ((): void => undefined)
    if (options.singleTab && doc.sections.length > 1)
        throw new Error(
            "singleTab needs a document flattened to one section (see flattenToSingleTab)"
        )
    if (!options.client && !OwidGoogleAuth.areGdocAuthKeysSet())
        throw new Error(
            "GDOCS_CLIENT_EMAIL and GDOCS_PRIVATE_KEY must be set to write to Google Docs"
        )
    const client =
        options.client ??
        googleDocs({
            version: "v1",
            auth: OwidGoogleAuth.getGoogleReadWriteAuth(),
        })
    const publisher = new DocPublisher(client, options.documentId, log)

    let document = await publisher.fetch()
    const targets = options.singleTab
        ? [firstTab(document)]
        : await publisher.ensureSectionTabs(document, doc.sections)

    // The tab list changed (new tabs, a rename); read it back once so the
    // clear step sees every tab's real content.
    document = await publisher.fetch()
    const tabsById = new Map(
        flattenTabs(document.tabs ?? []).map((tab) => [
            tab.tabProperties?.tabId ?? "",
            tab,
        ])
    )
    const tabIds = targets.map((tab) => tab.tabProperties!.tabId!)
    await publisher.clearTabs(tabIds.map((id) => tabsById.get(id)!))

    for (const [index, section] of doc.sections.entries()) {
        const tabId = tabIds[index]
        if (!tabId) break
        await publisher.writeSection(section, tabId)
    }
    return { tabIds }
}

function firstTab(document: docs_v1.Schema$Document): docs_v1.Schema$Tab {
    const tab = document.tabs?.[0]
    if (!tab?.tabProperties?.tabId)
        throw new Error("The document has no tabs to write into")
    return tab
}

export function flattenTabs(tabs: docs_v1.Schema$Tab[]): docs_v1.Schema$Tab[] {
    return tabs.flatMap((tab) => [tab, ...flattenTabs(tab.childTabs ?? [])])
}

function tabEndIndex(tab: docs_v1.Schema$Tab): number {
    const content = tab.documentTab?.body?.content ?? []
    return content.at(-1)?.endIndex ?? 2
}

class DocPublisher {
    constructor(
        private readonly client: docs_v1.Docs,
        private readonly documentId: string,
        private readonly log: (message: string) => void
    ) {}

    async fetch(): Promise<docs_v1.Schema$Document> {
        const { data } = await this.client.documents.get({
            documentId: this.documentId,
            includeTabsContent: true,
            suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
        })
        return data
    }

    /**
     * One tab per section, found by title. Missing tabs are created right
     * after the previous section's tab; a missing Overview tab is the first
     * tab, renamed. Returns the tabs in section order.
     */
    async ensureSectionTabs(
        document: docs_v1.Schema$Document,
        sections: Section[]
    ): Promise<docs_v1.Schema$Tab[]> {
        const topLevel = document.tabs ?? []
        const all = flattenTabs(topLevel)
        // A tab serves one section: the first tab, claimed as Overview, must
        // not also be matched by a later section that happens to share its title
        const claimed = new Set<string>()
        const byTitle = (title: string): docs_v1.Schema$Tab | undefined =>
            all.find(
                (tab) =>
                    tab.tabProperties?.title === title &&
                    !claimed.has(tab.tabProperties?.tabId ?? "")
            )

        // Simulated top-level tab order, so each new tab's `index` accounts
        // for the ones created before it in the same batch.
        const order = topLevel.map((tab) => tab.tabProperties?.tabId ?? "")
        const requests: Request[] = []
        const resolved: (docs_v1.Schema$Tab | string)[] = []
        let previousId: string | undefined

        for (const [sectionIndex, section] of sections.entries()) {
            let tab = byTitle(section.title)
            if (!tab && sectionIndex === 0) {
                tab = firstTab(document)
                requests.push({
                    updateDocumentTabProperties: {
                        tabProperties: {
                            tabId: tab.tabProperties!.tabId,
                            title: section.title,
                        },
                        fields: "title",
                    },
                })
                this.log(`Renaming the first tab to "${section.title}"`)
            }
            if (tab) {
                claimed.add(tab.tabProperties!.tabId!)
                previousId = tab.tabProperties!.tabId!
                resolved.push(tab)
                continue
            }
            const placeholder = `new:${section.title}`
            const previousPosition = previousId ? order.indexOf(previousId) : -1
            const index =
                previousPosition >= 0 ? previousPosition + 1 : order.length
            order.splice(index, 0, placeholder)
            requests.push({
                addDocumentTab: {
                    tabProperties: { title: section.title, index },
                },
            })
            this.log(`Adding tab "${section.title}"`)
            resolved.push(placeholder)
            previousId = placeholder
        }

        if (requests.length === 0) return resolved as docs_v1.Schema$Tab[]
        const replies = await this.batchUpdate(requests, "tab setup", 0, 1)
        // Pair each addDocumentTab reply with its placeholder, in order
        const createdIds = replies
            .map((reply) => reply.addDocumentTab?.tabProperties?.tabId)
            .filter((id): id is string => !!id)
        return resolved.map((entry) => {
            if (typeof entry !== "string") return entry
            const tabId = createdIds.shift()
            if (!tabId)
                throw new Error(
                    `Google did not return a tab id for "${entry.slice(4)}"`
                )
            return { tabProperties: { tabId, title: entry.slice(4) } }
        })
    }

    /** Empties every tab's body (index 1 … end-1; the final newline stays) */
    async clearTabs(tabs: docs_v1.Schema$Tab[]): Promise<void> {
        const requests: Request[] = []
        for (const tab of tabs) {
            const endIndex = tabEndIndex(tab)
            if (endIndex - 1 <= 1) continue
            requests.push({
                deleteContentRange: {
                    range: {
                        startIndex: 1,
                        endIndex: endIndex - 1,
                        tabId: tab.tabProperties!.tabId,
                    },
                },
            })
        }
        if (requests.length === 0) return
        this.log(`Clearing ${requests.length} tab(s)`)
        await this.batchUpdate(requests, "clear", 0, 1)
    }

    async writeSection(section: Section, tabId: string): Promise<void> {
        const pass1 = blocksToRequests(section.blocks, tabId, 1)
        const chunks = chunkRequests(pass1.requests)
        this.log(
            `${section.title}: writing ${section.blocks.length} blocks in ${chunks.length} chunk(s)`
        )
        for (const [index, chunk] of chunks.entries())
            await this.batchUpdate(
                chunk,
                `${section.title} pass 1`,
                index,
                chunks.length
            )
        if (pass1.tables.length > 0)
            await this.fillTables(section.title, tabId, pass1.tables)
    }

    private async fillTables(
        title: string,
        tabId: string,
        planned: PlannedTable[]
    ): Promise<void> {
        const document = await this.fetch()
        const tab = flattenTabs(document.tabs ?? []).find(
            (candidate) => candidate.tabProperties?.tabId === tabId
        )
        if (!tab) throw new Error(`Tab ${tabId} disappeared while writing`)
        const located = locateTables(tab.documentTab?.body?.content ?? [])
        const chunks = chunkRequests(fillTableRequests(planned, located, tabId))
        this.log(
            `${title}: filling ${planned.length} table(s) in ${chunks.length} chunk(s)`
        )
        for (const [index, chunk] of chunks.entries())
            await this.batchUpdate(
                chunk,
                `${title} pass 2`,
                index,
                chunks.length
            )
    }

    private async batchUpdate(
        requests: Request[],
        label: string,
        chunkIndex: number,
        chunkCount: number
    ): Promise<docs_v1.Schema$Response[]> {
        try {
            const { data } = await this.client.documents.batchUpdate({
                documentId: this.documentId,
                requestBody: { requests },
            })
            return data.replies ?? []
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            throw new Error(
                `batchUpdate failed (${label}, chunk ${chunkIndex + 1}/${chunkCount}, ${requests.length} requests): ${message}`,
                { cause: error }
            )
        }
    }
}
