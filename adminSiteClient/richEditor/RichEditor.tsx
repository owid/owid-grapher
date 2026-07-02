import { MutableRefObject, useMemo, useRef, useState } from "react"
import { Editor, Extensions, Node } from "@tiptap/core"
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { getRichEditorBaseExtensions } from "./extensions.js"
import { pmNodeNames } from "./serialization/pmJson.js"
import { enrichedBlocksToPmDoc } from "./serialization/serialization.js"
import { SlashCommands } from "./SlashCommands.js"
import { ImageBlockView } from "./nodeViews/ImageBlockView.js"
import { CtaBlockView } from "./nodeViews/CtaBlockView.js"
import { RawBlockView } from "./nodeViews/RawBlockView.js"
import { ImageSelectorModal } from "../ImageSelectorModal.js"

import "./RichEditor.scss"

const NODE_VIEWS = {
    [pmNodeNames.image]: ImageBlockView,
    [pmNodeNames.cta]: CtaBlockView,
    [pmNodeNames.rawBlock]: RawBlockView,
}

export function RichEditor(props: {
    initialBody: OwidEnrichedGdocBlock[]
    editorRef: MutableRefObject<Editor | null>
    /** Set to a function that opens the image picker and calls back with the chosen filename */
    requestImageRef?: MutableRefObject<
        ((insert: (filename: string) => void) => void) | null
    >
    onDirty: () => void
}): React.ReactElement {
    const { initialBody, editorRef, requestImageRef, onDirty } = props

    // Set when a slash-menu "Image" command is waiting for the user to pick
    // an image from the library
    const [pendingImageInsert, setPendingImageInsert] = useState<
        ((filename: string) => void) | null
    >(null)
    // useEditor only reads the initial value; keep callbacks in refs
    const onDirtyRef = useRef(onDirty)
    onDirtyRef.current = onDirty
    if (requestImageRef) {
        requestImageRef.current = (insert) =>
            setPendingImageInsert(() => insert)
    }

    const extensions = useMemo((): Extensions => {
        const base = getRichEditorBaseExtensions().map((extension) => {
            const nodeView =
                NODE_VIEWS[extension.name as keyof typeof NODE_VIEWS]
            if (nodeView && extension.type === "node") {
                return (extension as Node).extend({
                    addNodeView: () => ReactNodeViewRenderer(nodeView),
                })
            }
            return extension
        })
        return [
            ...base,
            SlashCommands.configure({
                onRequestImage: (insert) => setPendingImageInsert(() => insert),
            }),
        ]
    }, [])

    const initialDoc = useMemo(() => {
        const doc = enrichedBlocksToPmDoc(initialBody)
        // seed an empty paragraph so there is somewhere to type
        if (!doc.content || doc.content.length === 0) {
            doc.content = [{ type: pmNodeNames.paragraph }]
        }
        return doc
        // the editor manages its own state after mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const editor = useEditor({
        extensions,
        content: initialDoc,
        onUpdate: () => onDirtyRef.current(),
        onCreate: ({ editor: created }) => {
            editorRef.current = created
        },
        onDestroy: () => {
            editorRef.current = null
        },
        editorProps: {
            attributes: {
                class: "rich-editor-canvas__content",
            },
        },
    })

    return (
        <div className="rich-editor-canvas">
            <EditorContent editor={editor} />
            <ImageSelectorModal
                open={pendingImageInsert !== null}
                onSelect={(filename) => {
                    pendingImageInsert?.(filename)
                    setPendingImageInsert(null)
                }}
                onCancel={() => setPendingImageInsert(null)}
            />
        </div>
    )
}
