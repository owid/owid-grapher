import { useEffect, useState } from "react"
import * as Y from "yjs"
import { HocuspocusProvider } from "@hocuspocus/provider"
import { RICH_EDITOR_SYNC_PATH } from "../../adminShared/RichEditorTypes.js"

// Client side of the rich editor's live collaboration: one Y.Doc + websocket
// provider per open document. The provider buffers local edits through
// disconnects and merges on reconnect; persistence and enriched-JSON
// materialization happen server-side, so there is no client save loop in
// sync mode.

export interface RichEditorCollaboration {
    ydoc: Y.Doc
    provider: HocuspocusProvider
}

export type RichEditorSyncStatus =
    | "connecting"
    | "connected"
    | "disconnected"

export interface RichEditorCollaborationState {
    collaboration: RichEditorCollaboration | null
    status: RichEditorSyncStatus
    /** True once the initial server sync completed at least once */
    synced: boolean
}

function syncUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    return `${protocol}://${window.location.host}${RICH_EDITOR_SYNC_PATH}`
}

export function useRichEditorCollaboration(
    gdocId: string,
    enabled: boolean
): RichEditorCollaborationState {
    const [state, setState] = useState<RichEditorCollaborationState>({
        collaboration: null,
        status: "connecting",
        synced: false,
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
        setState({
            collaboration: { ydoc, provider },
            status: "connecting",
            synced: false,
        })
        return () => {
            provider.destroy()
            ydoc.destroy()
            setState({
                collaboration: null,
                status: "connecting",
                synced: false,
            })
        }
    }, [gdocId, enabled])

    return state
}
