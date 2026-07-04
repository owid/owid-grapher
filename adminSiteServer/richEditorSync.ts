import http from "http"
import { Duplex } from "stream"
import { randomUUID } from "crypto"
import * as Y from "yjs"
import { WebSocketServer } from "ws"
import { Hocuspocus } from "@hocuspocus/server"
import { getSchema } from "@tiptap/core"
import { Node as PmNode } from "@tiptap/pm/model"
import {
    prosemirrorJSONToYDoc,
    prosemirrorToYXmlFragment,
    yXmlFragmentToProseMirrorRootNode,
} from "@tiptap/y-tiptap"
import {
    OwidGdocAuthoringMode,
    PostsGdocsDraftsTableName,
    PostsGdocsTableName,
    PostsGdocsYdocsTableName,
    type DbRawPostGdoc,
    type DbRawPostGdocDraft,
    type DbRawPostGdocYdoc,
} from "@ourworldindata/types"
import { DbPlainUser } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import {
    getRichEditorBaseExtensions,
    RICH_EDITOR_PM_SCHEMA_VERSION,
} from "../adminShared/richEditor/extensions.js"
import {
    enrichedBlocksToPmDoc,
    pmDocToEnrichedBlocks,
} from "../adminShared/richEditor/serialization/serialization.js"
import {
    pmNodeNames,
    type PmNodeJson,
} from "../adminShared/richEditor/serialization/pmJson.js"
import { RICH_EDITOR_SYNC_PATH } from "../adminShared/RichEditorTypes.js"
import { materializeNativeGdocBody } from "./apiRoutes/richEditor.js"
import { authenticateWebsocketUpgrade } from "./authentication.js"

// The rich editor's Yjs sync server: multiple clients edit a document's live
// CRDT; this module persists it and keeps the enriched-JSON draft in sync.
//
// Invariants (see rich-editing-m5-plan.md §2/§4):
// - The ydoc blob (posts_gdocs_ydocs) is a live-collaboration transport,
//   never the source of truth. On every debounced store the document is
//   materialized back to enriched JSON through the ordinary draft/revision
//   path, so drafts, history, publish and bake never depend on CRDT state.
// - A ydoc row is disposable: absent or stale-schema rows are (re)seeded
//   from the draft JSON. Each seed gets a fresh `generation` id; clients
//   that buffered offline edits against a dead generation must reload.

/** TipTap's Collaboration extension binds this Y.XmlFragment field name */
const Y_DOC_FIELD = "default"

interface SyncContext {
    user: DbPlainUser
}

const serverSchema = getSchema(getRichEditorBaseExtensions())

function emptyPmDoc(): Record<string, unknown> {
    // seed an empty paragraph so there is somewhere to type (mirrors the
    // non-collaborative editor's initial doc)
    return {
        type: pmNodeNames.doc,
        content: [{ type: pmNodeNames.paragraph }],
    }
}

async function loadOrSeedYdoc(
    documentName: string,
    document: Y.Doc
): Promise<void> {
    await db.knexReadWriteTransaction(async (trx) => {
        const row = await trx
            .table(PostsGdocsTableName)
            .where({ id: documentName })
            .first<DbRawPostGdoc | undefined>()
        if (!row) throw new Error(`No document with id ${documentName}`)
        if (row.authoringMode !== OwidGdocAuthoringMode.Native)
            throw new Error(`Document ${documentName} is not natively edited`)

        const ydocRow = await trx
            .table(PostsGdocsYdocsTableName)
            .where({ gdocId: documentName })
            .first<DbRawPostGdocYdoc | undefined>()

        if (
            ydocRow &&
            ydocRow.schemaVersion === RICH_EDITOR_PM_SCHEMA_VERSION
        ) {
            Y.applyUpdate(document, ydocRow.ydoc)
            setDocumentGeneration(document, ydocRow.generation)
            return
        }

        // Seed (first open, or discard-and-reseed after a schema bump).
        // The draft JSON is current to within the store debounce, so a
        // stale-schema blob can simply be dropped.
        const draft = await trx
            .table(PostsGdocsDraftsTableName)
            .where({ gdocId: documentName })
            .first<DbRawPostGdocDraft | undefined>()
        const content = JSON.parse(draft?.content ?? row.content)
        const body = Array.isArray(content.body) ? content.body : []
        const pmDoc =
            body.length > 0 ? enrichedBlocksToPmDoc(body) : emptyPmDoc()

        const seeded = prosemirrorJSONToYDoc(serverSchema, pmDoc, Y_DOC_FIELD)
        Y.applyUpdate(document, Y.encodeStateAsUpdate(seeded))

        const generation = randomUUID()
        setDocumentGeneration(document, generation)
        await trx
            .table(PostsGdocsYdocsTableName)
            .insert({
                gdocId: documentName,
                ydoc: Buffer.from(Y.encodeStateAsUpdate(document)),
                schemaVersion: RICH_EDITOR_PM_SCHEMA_VERSION,
                generation,
                seededFromRevisionId: draft ? Number(draft.revisionId) : null,
            })
            .onConflict("gdocId")
            .merge([
                "ydoc",
                "schemaVersion",
                "generation",
                "seededFromRevisionId",
            ])
    })
}

/**
 * The generation id is exposed to clients inside the ydoc itself (a Y.Map
 * set by the server at seed/load time), so a client can detect that it
 * reconnected to a different generation than the one it buffered offline
 * edits against, and reload instead of merging into the wrong document.
 */
function setDocumentGeneration(document: Y.Doc, generation: string): void {
    const meta = document.getMap<string>("richEditorMeta")
    if (meta.get("generation") !== generation) {
        meta.set("generation", generation)
    }
}

async function storeAndMaterialize(
    documentName: string,
    document: Y.Doc,
    user: DbPlainUser | undefined
): Promise<void> {
    const update = Buffer.from(Y.encodeStateAsUpdate(document))

    // Materialization must never write invalid JSON: if the conversion
    // throws, keep the previous draft head (the ydoc blob is still stored,
    // nothing is lost) and surface the error.
    let body: ReturnType<typeof pmDocToEnrichedBlocks> | null = null
    let materializeError: unknown = null
    try {
        const pmDoc = yXmlFragmentToProseMirrorRootNode(
            document.getXmlFragment(Y_DOC_FIELD),
            serverSchema
        ).toJSON() as PmNodeJson
        body = pmDocToEnrichedBlocks(pmDoc)
    } catch (error) {
        materializeError = error
    }

    await db.knexReadWriteTransaction(async (trx) => {
        await trx
            .table(PostsGdocsYdocsTableName)
            .where({ gdocId: documentName })
            .update({ ydoc: update })
        if (body) {
            await materializeNativeGdocBody(
                trx,
                documentName,
                body,
                user?.id ?? null
            )
        }
    })

    if (materializeError) {
        console.error(
            `rich editor sync: materialization failed for ${documentName}`,
            materializeError
        )
        throw materializeError
    }
}

let syncInstance: Hocuspocus<SyncContext> | null = null

const YDOC_IDLE_DISPOSAL_DAYS = 7
const YDOC_DISPOSAL_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Drop ydoc blobs that have not been touched in a while and are not loaded
 * right now. Purely a growth bound: the draft JSON is the durable format,
 * so a disposed doc simply reseeds on the next open. Exported for tests.
 */
export async function disposeIdleYdocs(
    idleDays: number = YDOC_IDLE_DISPOSAL_DAYS
): Promise<number> {
    const loaded = [...(syncInstance?.documents.keys() ?? [])]
    return db.knexReadWriteTransaction(async (trx) => {
        const cutoff = new Date(Date.now() - idleDays * 24 * 60 * 60 * 1000)
        let query = trx
            .table(PostsGdocsYdocsTableName)
            .where("updatedAt", "<", cutoff)
        if (loaded.length > 0) query = query.whereNotIn("gdocId", loaded)
        return query.delete()
    })
}

/**
 * Reconcile the live collaboration state with the (committed) draft after a
 * restore. If the document is loaded on the sync server, the restored body
 * is diffed into the live Y fragment as an ordinary Yjs transaction — every
 * connected client sees the restore like a remote edit, and the next store
 * persists it. If it is not loaded, the stored blob is simply dropped: the
 * next open reseeds from the restored draft. Call only after the draft
 * write has committed.
 */
export async function applyDraftToSyncDocument(
    documentName: string
): Promise<void> {
    const instance = syncInstance
    const liveDoc = instance?.documents.get(documentName)

    if (!liveDoc) {
        await db.knexReadWriteTransaction((trx) =>
            trx
                .table(PostsGdocsYdocsTableName)
                .where({ gdocId: documentName })
                .delete()
        )
        return
    }

    const draft = await db.knexReadonlyTransaction((trx) =>
        trx
            .table(PostsGdocsDraftsTableName)
            .where({ gdocId: documentName })
            .first<DbRawPostGdocDraft | undefined>()
    )
    if (!draft) return
    const content = JSON.parse(draft.content)
    const body = Array.isArray(content.body) ? content.body : []
    const pmJson = body.length > 0 ? enrichedBlocksToPmDoc(body) : emptyPmDoc()
    const pmNode = PmNode.fromJSON(serverSchema, pmJson)
    // updateYFragment diffs the fragment against the target doc in place
    prosemirrorToYXmlFragment(
        pmNode,
        liveDoc.getXmlFragment(Y_DOC_FIELD) as never
    )
}

/**
 * Persist and materialize a document's pending debounced store right now.
 * Called before publish so the draft head reflects what the authors see in
 * the canvas, not the state as of up to `maxDebounce` ago. A no-op when the
 * document is not loaded or has no pending store.
 */
export async function flushRichEditorSyncDocument(
    documentName: string
): Promise<void> {
    const instance = syncInstance
    if (!instance) return
    const debounceId = `onStoreDocument-${documentName}`
    if (instance.debouncer.isDebounced(debounceId)) {
        await instance.debouncer.executeNow(debounceId)
    }
}

export function createRichEditorSyncServer(): Hocuspocus<SyncContext> {
    syncInstance = new Hocuspocus<SyncContext>({
        quiet: true,
        // debounce persistence/materialization; the final store on
        // disconnect happens regardless
        debounce: 2000,
        maxDebounce: 10_000,

        onLoadDocument: async ({ document, documentName }) => {
            await loadOrSeedYdoc(documentName, document)
        },

        onStoreDocument: async ({ document, documentName, lastContext }) => {
            await storeAndMaterialize(documentName, document, lastContext?.user)
        },
    })
    return syncInstance
}

/**
 * Attach the sync server to the admin HTTP server: authenticated websocket
 * upgrades on RICH_EDITOR_SYNC_PATH are handed to Hocuspocus, everything
 * else is left to other upgrade listeners (e.g. vite's HMR in dev).
 */
export function attachRichEditorSyncServer(
    server: http.Server,
    hocuspocus: Hocuspocus<SyncContext>
): void {
    const wss = new WebSocketServer({ noServer: true })

    const disposalInterval = setInterval(() => {
        disposeIdleYdocs().catch((error) =>
            console.error("rich editor sync: idle ydoc disposal failed", error)
        )
    }, YDOC_DISPOSAL_SWEEP_INTERVAL_MS)
    // don't keep the process alive for the sweep
    disposalInterval.unref()
    server.on("close", () => clearInterval(disposalInterval))

    server.on(
        "upgrade",
        (request: http.IncomingMessage, socket: Duplex, head: Buffer) => {
            const url = new URL(
                request.url ?? "/",
                `http://${request.headers.host ?? "localhost"}`
            )
            if (url.pathname !== RICH_EDITOR_SYNC_PATH) return

            void (async () => {
                const user = await authenticateWebsocketUpgrade({
                    headers: request.headers,
                    socketRemoteAddress: request.socket.remoteAddress,
                }).catch(() => null)
                if (!user) {
                    socket.write(
                        "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
                    )
                    socket.destroy()
                    return
                }
                wss.handleUpgrade(request, socket, head, (websocket) => {
                    const fetchRequest = new Request(url, {
                        headers: Object.entries(request.headers).flatMap(
                            ([name, value]): [string, string][] => {
                                if (value === undefined) return []
                                if (Array.isArray(value))
                                    return value.map((item) => [name, item])
                                return [[name, value]]
                            }
                        ),
                    })
                    // handleConnection does not attach socket listeners
                    // itself; the caller feeds it inbound events
                    const clientConnection = hocuspocus.handleConnection(
                        websocket,
                        fetchRequest,
                        { user }
                    )
                    websocket.on("message", (data: Buffer) => {
                        clientConnection.handleMessage(new Uint8Array(data))
                    })
                    websocket.on("close", () => {
                        clientConnection.handleClose()
                    })
                    websocket.on("error", () => {
                        clientConnection.handleClose()
                    })
                })
            })()
        }
    )
}
