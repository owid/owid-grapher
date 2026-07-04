import { PluginKey } from "@tiptap/pm/state"
import * as Y from "yjs"
import {
    relativePositionToAbsolutePosition,
    ySyncPluginKey,
    yUndoPluginKey,
} from "@tiptap/y-tiptap"

// y-tiptap's types resolve prosemirror-state through its own peer instance,
// which TS treats as a different identity than @tiptap/pm's re-export (the
// runtime module is one and the same). Re-type the sync plugin key against
// ours once, for every consumer.

export interface YSyncPluginState {
    doc: Y.Doc & { clientID: number }
    type: Parameters<typeof relativePositionToAbsolutePosition>[1]
    binding: {
        mapping: Parameters<typeof relativePositionToAbsolutePosition>[3] & {
            size: number
        }
    } | null
    snapshot?: unknown
}

export const syncPluginKey =
    ySyncPluginKey as unknown as PluginKey<YSyncPluginState>

export interface YUndoPluginState {
    undoManager?: {
        stopCapturing(): void
    }
}

export const undoPluginKey =
    yUndoPluginKey as unknown as PluginKey<YUndoPluginState>
