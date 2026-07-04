import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import { WebSocket } from "ws"
import {
    HocuspocusProvider,
    HocuspocusProviderWebsocket,
} from "@hocuspocus/provider"
import { getSchema } from "@tiptap/core"
import { Node as PmNode } from "@tiptap/pm/model"
import {
    prosemirrorToYXmlFragment,
    yDocToProsemirrorJSON,
} from "@tiptap/y-tiptap"
import {
    PostsGdocsYdocsTableName,
    type OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { getRichEditorBaseExtensions } from "../../adminShared/richEditor/extensions.js"
import {
    enrichedBlocksToPmDoc,
    pmDocToEnrichedBlocks,
} from "../../adminShared/richEditor/serialization/serialization.js"
import type { PmNodeJson } from "../../adminShared/richEditor/serialization/pmJson.js"
import { getAdminTestEnv } from "./testEnv.js"

// Reconciliation harness for the rich editor sync server: headless
// Hocuspocus providers play the role of browser editors, and every
// CRDT ⇄ JSON boundary from rich-editing-m5-plan.md §4 is exercised over a
// real websocket against the real API + database.

const env = getAdminTestEnv()
const schema = getSchema(getRichEditorBaseExtensions())

const makeTextBlock = (text: string): OwidEnrichedGdocBlock =>
    ({
        type: "text",
        value: [{ spanType: "span-simple-text", text }],
        parseErrors: [],
    }) as OwidEnrichedGdocBlock

interface TestClient {
    ydoc: Y.Doc
    provider: HocuspocusProvider
    synced: Promise<void>
    destroy: () => void
}

function connect(gdocId: string): TestClient {
    const wsUrl = env.baseUrl
        .replace(/^http/, "ws")
        .replace(/\/admin\/api$/, "/admin/api/richEditorSync")
    const apiKey = env.apiKey
    // browser-style WebSocket cannot set headers; wrap ws to add auth
    class AuthedWebSocket extends WebSocket {
        constructor(address: string, protocols?: string | string[]) {
            super(address, protocols, {
                headers: { Authorization: `Bearer ${apiKey}` },
            })
        }
    }
    const ydoc = new Y.Doc()
    let resolveSynced: () => void = () => undefined
    const synced = new Promise<void>((resolve) => {
        resolveSynced = resolve
    })
    const websocketProvider = new HocuspocusProviderWebsocket({
        url: wsUrl,
        WebSocketPolyfill: AuthedWebSocket,
    })
    const provider = new HocuspocusProvider({
        websocketProvider,
        name: gdocId,
        document: ydoc,
        onSynced: () => resolveSynced(),
    })
    // with an explicit websocketProvider the provider does not auto-attach
    provider.attach()
    return {
        ydoc,
        provider,
        synced,
        destroy: () => {
            provider.destroy()
            websocketProvider.destroy()
            ydoc.destroy()
        },
    }
}

function bodyOf(ydoc: Y.Doc): OwidEnrichedGdocBlock[] {
    const pmJson = yDocToProsemirrorJSON(
        ydoc,
        "default"
    ) as unknown as PmNodeJson
    return pmDocToEnrichedBlocks(pmJson)
}

function textOf(body: OwidEnrichedGdocBlock[]): string[] {
    return body
        .filter((block) => block.type === "text")
        .map((block) =>
            (block as { value: { text?: string }[] }).value
                .map((span) => span.text ?? "")
                .join("")
        )
}

/** Apply a whole-body edit to a client's ydoc, like an editor would. */
function editBody(ydoc: Y.Doc, body: OwidEnrichedGdocBlock[]): void {
    const pmNode = PmNode.fromJSON(schema, enrichedBlocksToPmDoc(body))
    prosemirrorToYXmlFragment(pmNode, ydoc.getXmlFragment("default") as never)
}

function waitFor(
    condition: () => boolean,
    timeoutMs = 5000,
    label = "condition"
): Promise<void> {
    return new Promise((resolve, reject) => {
        const start = Date.now()
        const poll = (): void => {
            if (condition()) return resolve()
            if (Date.now() - start > timeoutMs)
                return reject(new Error(`Timed out waiting for ${label}`))
            setTimeout(poll, 25)
        }
        poll()
    })
}

async function createDocWithBody(
    title: string,
    body: OwidEnrichedGdocBlock[]
): Promise<{ id: string; revisionId: number }> {
    const created = await env.request({
        method: "POST",
        path: "/gdocs/createNative",
        body: JSON.stringify({ title }),
    })
    const saved = await env.request({
        method: "PUT",
        path: `/gdocs/${created.id}/body`,
        body: JSON.stringify({
            body,
            baseRevisionId: created.draftRevisionId,
            kind: "manual",
        }),
    })
    return { id: created.id, revisionId: saved.revisionId }
}

describe("rich editor sync server", { timeout: 30000 }, () => {
    it("seeds a ydoc from the draft and syncs it to a client", async () => {
        const { id } = await createDocWithBody("Sync seed test", [
            makeTextBlock("Seeded content"),
        ])

        const client = connect(id)
        try {
            await client.synced
            await waitFor(
                () => textOf(bodyOf(client.ydoc)).includes("Seeded content"),
                5000,
                "seeded content to arrive"
            )
            const ydocRow = await env
                .testKnex(PostsGdocsYdocsTableName)
                .where({ gdocId: id })
                .first()
            expect(ydocRow).toBeDefined()
            expect(ydocRow.generation).toBeTruthy()
        } finally {
            client.destroy()
        }
    })

    it("materializes edits into the draft and revisions via syncFlush", async () => {
        const { id } = await createDocWithBody("Sync materialize test", [
            makeTextBlock("Before edit"),
        ])

        const client = connect(id)
        try {
            await client.synced
            await waitFor(
                () => textOf(bodyOf(client.ydoc)).includes("Before edit"),
                5000,
                "initial sync"
            )
            editBody(client.ydoc, [
                makeTextBlock("Before edit"),
                makeTextBlock("Added live"),
            ])
            // the update needs a beat to reach the server, then flush the
            // debounced store
            await new Promise((resolve) => setTimeout(resolve, 300))
            await env.request({
                method: "POST",
                path: `/gdocs/${id}/syncFlush`,
            })
            const editorView = await env.fetchJson(`/gdocs/${id}/editor`)
            expect(textOf(editorView.content.body)).toContain("Added live")
        } finally {
            client.destroy()
        }
    })

    it("merges concurrent clients live", async () => {
        const { id } = await createDocWithBody("Sync merge test", [
            makeTextBlock("Shared base"),
        ])

        const clientA = connect(id)
        const clientB = connect(id)
        try {
            await clientA.synced
            await clientB.synced
            await waitFor(
                () => textOf(bodyOf(clientB.ydoc)).includes("Shared base"),
                5000,
                "client B initial sync"
            )

            editBody(clientA.ydoc, [
                makeTextBlock("Shared base"),
                makeTextBlock("From A"),
            ])
            await waitFor(
                () => textOf(bodyOf(clientB.ydoc)).includes("From A"),
                5000,
                "A's edit to reach B"
            )

            editBody(clientB.ydoc, [
                ...bodyOf(clientB.ydoc),
                makeTextBlock("From B"),
            ])
            await waitFor(
                () => textOf(bodyOf(clientA.ydoc)).includes("From B"),
                5000,
                "B's edit to reach A"
            )
        } finally {
            clientA.destroy()
            clientB.destroy()
        }
    })

    it("applies a restore to the live document as a remote edit", async () => {
        const { id, revisionId } = await createDocWithBody(
            "Sync restore test",
            [makeTextBlock("Original body")]
        )

        const client = connect(id)
        try {
            await client.synced
            await waitFor(
                () => textOf(bodyOf(client.ydoc)).includes("Original body"),
                5000,
                "initial sync"
            )
            editBody(client.ydoc, [makeTextBlock("Changed body")])
            await new Promise((resolve) => setTimeout(resolve, 300))
            await env.request({
                method: "POST",
                path: `/gdocs/${id}/syncFlush`,
            })

            await env.request({
                method: "POST",
                path: `/gdocs/${id}/revisions/${revisionId}/restore`,
            })
            await waitFor(
                () => textOf(bodyOf(client.ydoc)).includes("Original body"),
                5000,
                "restore to reach the live client"
            )
        } finally {
            client.destroy()
        }
    })

    it("reseeds from the draft when the ydoc row is deleted", async () => {
        const { id } = await createDocWithBody("Sync reseed test", [
            makeTextBlock("Reseed me"),
        ])

        const clientA = connect(id)
        let firstGeneration: string
        try {
            await clientA.synced
            await waitFor(
                () => textOf(bodyOf(clientA.ydoc)).includes("Reseed me"),
                5000,
                "initial sync"
            )
            const row = await env
                .testKnex(PostsGdocsYdocsTableName)
                .where({ gdocId: id })
                .first()
            firstGeneration = row.generation
        } finally {
            clientA.destroy()
        }

        // wait until the document is unloaded server-side (final store done),
        // then drop the blob — the disposal path
        await waitFor(
            () => !env.app.richEditorSync?.documents.has(id),
            5000,
            "document unload"
        )
        await env
            .testKnex(PostsGdocsYdocsTableName)
            .where({ gdocId: id })
            .delete()

        const clientB = connect(id)
        try {
            await clientB.synced
            await waitFor(
                () => textOf(bodyOf(clientB.ydoc)).includes("Reseed me"),
                5000,
                "reseeded content"
            )
            const row = await env
                .testKnex(PostsGdocsYdocsTableName)
                .where({ gdocId: id })
                .first()
            expect(row.generation).not.toBe(firstGeneration)
        } finally {
            clientB.destroy()
        }
    })

    it("refuses unauthenticated websocket upgrades", async () => {
        const { id } = await createDocWithBody("Sync auth test", [
            makeTextBlock("Secret"),
        ])
        const wsUrl = env.baseUrl
            .replace(/^http/, "ws")
            .replace(/\/admin\/api$/, "/admin/api/richEditorSync")
        const socket = new WebSocket(`${wsUrl}?documentName=${id}`)
        const failed = await new Promise<boolean>((resolve) => {
            socket.on("error", () => resolve(true))
            socket.on("close", () => resolve(true))
            socket.on("open", () => resolve(false))
            setTimeout(() => resolve(false), 4000)
        })
        expect(failed).toBe(true)
        socket.close()
    })
})
