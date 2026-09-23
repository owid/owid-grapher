import { Extension } from "@tiptap/core"
import { Plugin, PluginKey, EditorState } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import * as Y from "yjs"
import type { Awareness } from "y-protocols/awareness"
import { relativePositionToAbsolutePosition } from "@tiptap/y-tiptap"
import { isIdentifiedNodeName } from "../../adminShared/richEditor/serialization/pmJson.js"
import { syncPluginKey } from "./ySync.js"

// Remote block selections: the CollaborationCaret extension renders remote
// text carets and inline selection highlights, but an inline decoration is
// invisible on an atom block (a chart, an image). When a remote user's
// selection is a NodeSelection of a framed block, this plugin puts a
// colored outline + name chip on the block's DOM instead — the block-level
// equivalent of seeing someone's cursor.

interface RemoteCursorState {
    cursor?: { anchor: unknown; head: unknown } | null
    user?: { name?: string; color?: string } | null
}

const remoteBlockSelectionsKey = new PluginKey<DecorationSet>(
    "remoteBlockSelections"
)

function buildDecorations(
    state: EditorState,
    awareness: Awareness
): DecorationSet {
    const ystate = syncPluginKey.getState(state)
    if (
        !ystate?.doc ||
        !ystate.binding ||
        ystate.binding.mapping.size === 0 ||
        ystate.snapshot
    ) {
        return DecorationSet.empty
    }
    const { doc: ydoc, type: fragmentType, binding } = ystate
    const decorations: Decoration[] = []
    awareness.getStates().forEach((aw: RemoteCursorState, clientId) => {
        if (clientId === ydoc.clientID) return
        if (!aw?.cursor?.anchor || !aw.cursor.head) return
        const anchor = relativePositionToAbsolutePosition(
            ydoc,
            fragmentType,
            Y.createRelativePositionFromJSON(aw.cursor.anchor),
            binding.mapping
        )
        const head = relativePositionToAbsolutePosition(
            ydoc,
            fragmentType,
            Y.createRelativePositionFromJSON(aw.cursor.head),
            binding.mapping
        )
        if (anchor === null || head === null) return
        const from = Math.min(anchor, head)
        const to = Math.max(anchor, head)
        if (from < 0 || to > state.doc.content.size) return
        const node = state.doc.nodeAt(from)
        // only whole-block selections of framed blocks get an outline
        if (!node || !isIdentifiedNodeName(node.type.name)) return
        if (to - from !== node.nodeSize) return
        const name = aw.user?.name ?? `User ${clientId}`
        const color = aw.user?.color ?? "#ffa500"
        decorations.push(
            Decoration.node(from, to, {
                class: "rich-editor-remote-block-selection",
                style: `--remote-selection-color: ${color}`,
                "data-remote-user": name,
            })
        )
    })
    return DecorationSet.create(state.doc, decorations)
}

function remoteBlockSelectionsPlugin(awareness: Awareness): Plugin {
    return new Plugin<DecorationSet>({
        key: remoteBlockSelectionsKey,
        state: {
            init: (_config, state) => buildDecorations(state, awareness),
            apply: (_tr, _value, _oldState, newState) =>
                buildDecorations(newState, awareness),
        },
        props: {
            decorations: (state) => remoteBlockSelectionsKey.getState(state),
        },
        view: (view) => {
            // awareness changes don't produce transactions; poke the plugin
            const onAwarenessChange = (): void => {
                view.dispatch(
                    view.state.tr.setMeta(remoteBlockSelectionsKey, "refresh")
                )
            }
            awareness.on("change", onAwarenessChange)
            return {
                destroy: () => awareness.off("change", onAwarenessChange),
            }
        },
    })
}

export function createRemoteBlockSelectionsExtension(
    awareness: Awareness
): Extension {
    return Extension.create({
        name: "remoteBlockSelections",
        addProseMirrorPlugins() {
            return [remoteBlockSelectionsPlugin(awareness)]
        },
    })
}
