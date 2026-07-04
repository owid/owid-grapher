import { useEffect, useState } from "react"
import * as Y from "yjs"
import { HocuspocusProvider } from "@hocuspocus/provider"
import { RICH_EDITOR_SYNC_PATH } from "../../adminShared/RichEditorTypes.js"

// Client side of the rich editor's live collaboration: one Y.Doc + websocket
// provider per open document. The provider buffers local edits through
// disconnects and merges on reconnect; persistence and enriched-JSON
// materialization happen server-side, so there is no client save loop in
// sync mode.

/** The identity a collaborator presents in awareness (cursors, presence) */
export interface RichEditorCollaborationUser {
    name: string
    color: string
    /** Humans in browsers vs agents connecting headlessly */
    kind: "user" | "agent"
}

export interface RichEditorCollaboration {
    ydoc: Y.Doc
    provider: HocuspocusProvider
    user: RichEditorCollaborationUser
}

export type RichEditorSyncStatus = "connecting" | "connected" | "disconnected"

export interface RichEditorCollaborationState {
    collaboration: RichEditorCollaboration | null
    status: RichEditorSyncStatus
    /** True once the initial server sync completed at least once */
    synced: boolean
    /**
     * True when the server-side document generation changed while we were
     * connected or reconnecting — the ydoc was discarded and reseeded
     * (schema bump, idle disposal, manual reset) and this client must
     * reload rather than merge into a document it never saw.
     */
    generationChanged: boolean
}

// 6-digit RGB only (y-prosemirror requirement); picked for contrast on white
const COLLABORATOR_COLORS = [
    "#d73a49",
    "#e36209",
    "#b08800",
    "#22863a",
    "#0366d6",
    "#5a32a3",
    "#b93a86",
    "#0598af",
]

export function collaborationUserColor(name: string): string {
    let hash = 0
    for (let index = 0; index < name.length; index++) {
        hash = (hash * 31 + name.charCodeAt(index)) | 0
    }
    return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length]
}

function syncUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    return `${protocol}://${window.location.host}${RICH_EDITOR_SYNC_PATH}`
}

export function useRichEditorCollaboration(
    gdocId: string,
    enabled: boolean,
    userName: string
): RichEditorCollaborationState {
    const [state, setState] = useState<RichEditorCollaborationState>({
        collaboration: null,
        status: "connecting",
        synced: false,
        generationChanged: false,
    })

    useEffect(() => {
        if (!enabled) return undefined
        const ydoc = new Y.Doc()
        const provider = new HocuspocusProvider({
            url: syncUrl(),
            name: gdocId,
            document: ydoc,
            onStatus: ({ status }) => {
                setState((current) => ({
                    ...current,
                    status:
                        status === "connected"
                            ? "connected"
                            : status === "connecting"
                              ? "connecting"
                              : "disconnected",
                }))
            },
            onSynced: () => {
                setState((current) => ({ ...current, synced: true }))
            },
        })

        // Generation guard: the server stamps each seed of the document with
        // a generation id inside the ydoc. If it changes under us, our local
        // Yjs state (including anything buffered offline) belongs to a dead
        // document and must not be merged — reload instead.
        const meta = ydoc.getMap<string>("richEditorMeta")
        let knownGeneration: string | undefined
        const checkGeneration = (): void => {
            const generation = meta.get("generation")
            if (!generation) return
            if (!knownGeneration) {
                knownGeneration = generation
                return
            }
            if (generation !== knownGeneration) {
                provider.destroy()
                setState((current) => ({
                    ...current,
                    generationChanged: true,
                }))
            }
        }
        meta.observe(checkGeneration)

        setState({
            collaboration: {
                ydoc,
                provider,
                user: {
                    name: userName,
                    color: collaborationUserColor(userName),
                    kind: "user",
                },
            },
            status: "connecting",
            synced: false,
            generationChanged: false,
        })
        return () => {
            meta.unobserve(checkGeneration)
            provider.destroy()
            ydoc.destroy()
            setState({
                collaboration: null,
                status: "connecting",
                synced: false,
                generationChanged: false,
            })
        }
    }, [gdocId, enabled, userName])

    return state
}

export interface AwarenessPeer {
    clientId: number
    name: string
    color: string
    kind: "user" | "agent"
}

/**
 * The other people (and agents) connected to this document, from the sync
 * connection's awareness states. Replaces the old heartbeat presence.
 */
export function useAwarenessPeers(
    collaboration: RichEditorCollaboration | null
): AwarenessPeer[] {
    const [peers, setPeers] = useState<AwarenessPeer[]>([])

    useEffect(() => {
        if (!collaboration) {
            setPeers([])
            return undefined
        }
        const awareness = collaboration.provider.awareness
        if (!awareness) return undefined
        const update = (): void => {
            const next: AwarenessPeer[] = []
            awareness.getStates().forEach((state, clientId) => {
                if (clientId === awareness.clientID) return
                const user = state?.user as
                    | Partial<RichEditorCollaborationUser>
                    | undefined
                if (!user?.name) return
                next.push({
                    clientId,
                    name: user.name,
                    color: user.color ?? "#666666",
                    kind: user.kind === "agent" ? "agent" : "user",
                })
            })
            // stable order so the banner doesn't jitter
            next.sort((a, b) => a.clientId - b.clientId)
            setPeers(next)
        }
        update()
        awareness.on("change", update)
        return () => {
            awareness.off("change", update)
            setPeers([])
        }
    }, [collaboration])

    return peers
}
