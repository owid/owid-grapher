import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Fragment, Slice } from "@tiptap/pm/model"
import { dropPoint } from "@tiptap/pm/transform"
import type { EditorView } from "@tiptap/pm/view"
import { pmNodeNames } from "../../adminShared/richEditor/serialization/pmJson.js"
import { RICH_EDITOR_PALETTE_DRAG_MIME } from "./blockRegistry.js"

export interface PaletteDropOptions {
    /**
     * Called when a palette item is dropped on the canvas, with the item's
     * key and the document position (a block boundary) to insert it at.
     */
    onDrop: (itemKey: string, pos: number) => void
}

const paletteDropKey = new PluginKey("paletteDrop")

function isPaletteDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types
    if (!types) return false
    // DataTransfer.types is a DOMStringList in some browsers, an array in others
    return Array.from(types).includes(RICH_EDITOR_PALETTE_DRAG_MIME)
}

/**
 * Drop target for dragging block items from the insert palette into the
 * canvas.
 *
 * While a palette item is dragged over the editor, the view's `dragging`
 * state is set to a placeholder slice (an empty paragraph), so the regular
 * drop cursor draws its block-level indicator at the exact boundary the item
 * will land on — the same `dropPoint` computation the drop handler uses,
 * and the same feedback as when reordering blocks within the canvas.
 * `view.dragging` is cleared again when the drag leaves the editor without
 * dropping, so a later external drop (plain text from another window) isn't
 * mistaken for the placeholder.
 */
export const PaletteDrop = Extension.create<PaletteDropOptions>({
    name: "paletteDrop",

    addOptions() {
        return {
            onDrop: () => undefined,
        }
    },

    addProseMirrorPlugins() {
        const { onDrop } = this.options
        const placeholderSlice = new Slice(
            Fragment.from(
                this.editor.schema.nodes[pmNodeNames.paragraph].create()
            ),
            0,
            0
        )
        const isOurDragging = (view: EditorView): boolean =>
            view.dragging?.slice === placeholderSlice

        const resolveDropPos = (view: EditorView, event: DragEvent): number => {
            const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
            })
            const pos = coords?.pos ?? view.state.doc.content.size
            const point = dropPoint(view.state.doc, pos, placeholderSlice)
            if (point !== null) return point
            // no valid block boundary found near the pointer: fall back to
            // the end of the enclosing text block (or the position itself)
            const $pos = view.state.doc.resolve(pos)
            return $pos.parent.isTextblock ? $pos.after() : pos
        }

        return [
            new Plugin({
                key: paletteDropKey,
                props: {
                    handleDOMEvents: {
                        dragenter: (view, event) => {
                            if (!isPaletteDrag(event)) return false
                            view.dragging = {
                                slice: placeholderSlice,
                                move: false,
                            }
                            event.preventDefault()
                            return false
                        },
                        dragover: (view, event) => {
                            if (!isPaletteDrag(event)) return false
                            if (!isOurDragging(view)) {
                                view.dragging = {
                                    slice: placeholderSlice,
                                    move: false,
                                }
                            }
                            if (event.dataTransfer)
                                event.dataTransfer.dropEffect = "copy"
                            event.preventDefault()
                            return false
                        },
                        dragleave: (view, event) => {
                            if (!isOurDragging(view)) return false
                            const related = event.relatedTarget
                            if (
                                related instanceof Node &&
                                view.dom.contains(related)
                            )
                                return false
                            view.dragging = null
                            return false
                        },
                    },
                    handleDrop: (view, event) => {
                        if (!isPaletteDrag(event)) return false
                        const itemKey = event.dataTransfer?.getData(
                            RICH_EDITOR_PALETTE_DRAG_MIME
                        )
                        // ProseMirror has already cleared view.dragging
                        event.preventDefault()
                        if (!itemKey) return true
                        onDrop(itemKey, resolveDropPos(view, event))
                        return true
                    },
                },
            }),
        ]
    },
})
