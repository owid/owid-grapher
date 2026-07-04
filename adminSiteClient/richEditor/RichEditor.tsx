import { RefObject, useMemo, useRef, useState } from "react"
import { Editor, Extensions, Node } from "@tiptap/core"
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react"
// The schema extensions live in adminShared, which is a separate TS project;
// import the TipTap extension packages here so their module augmentations
// (chain().toggleBold(), undo(), …) apply to this program's command types.
import "@tiptap/starter-kit"
import "@tiptap/extension-subscript"
import "@tiptap/extension-superscript"
import { OwidEnrichedGdocBlock, OwidGdocType } from "@ourworldindata/types"
import { getRichEditorBaseExtensions } from "../../adminShared/richEditor/extensions.js"
import { pmNodeNames } from "../../adminShared/richEditor/serialization/pmJson.js"
import { enrichedBlocksToPmDoc } from "../../adminShared/richEditor/serialization/serialization.js"
import { Collaboration } from "@tiptap/extension-collaboration"
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret"
import { SlashCommands } from "./SlashCommands.js"
import { CommentMark } from "./comments.js"
import { BlockIdAssignment, ensureBlockIds } from "./blockIdentity.js"
import type { RichEditorCollaboration } from "./collaboration.js"
import { createRemoteBlockSelectionsExtension } from "./remoteBlockSelections.js"
import { ImageBlockView } from "./nodeViews/ImageBlockView.js"
import { CtaBlockView } from "./nodeViews/CtaBlockView.js"
import { RawBlockView } from "./nodeViews/RawBlockView.js"
import {
    AllChartsBlockView,
    ChartBlockView,
    NarrativeChartBlockView,
    ProminentLinkBlockView,
    RecircBlockView,
    ResearchAndWritingBlockView,
    VideoBlockView,
} from "./nodeViews/AtomBlockViews.js"
import {
    AsideBlockView,
    BlockquoteBlockView,
    CalloutBlockView,
    ExpandableParagraphBlockView,
    GraySectionBlockView,
    PullQuoteContainerView,
    SideBySideBlockView,
    StickyLeftBlockView,
    StickyRightBlockView,
    TableContainerView,
} from "./nodeViews/ContainerBlockViews.js"
import { ImageSelectorModal } from "../ImageSelectorModal.js"

import "./RichEditor.scss"

const NODE_VIEWS = {
    [pmNodeNames.image]: ImageBlockView,
    [pmNodeNames.cta]: CtaBlockView,
    [pmNodeNames.rawBlock]: RawBlockView,
    [pmNodeNames.chart]: ChartBlockView,
    [pmNodeNames.narrativeChart]: NarrativeChartBlockView,
    [pmNodeNames.video]: VideoBlockView,
    [pmNodeNames.prominentLink]: ProminentLinkBlockView,
    [pmNodeNames.pullQuote]: PullQuoteContainerView,
    [pmNodeNames.tableBlock]: TableContainerView,
    [pmNodeNames.recirc]: RecircBlockView,
    [pmNodeNames.researchAndWriting]: ResearchAndWritingBlockView,
    [pmNodeNames.allCharts]: AllChartsBlockView,
    [pmNodeNames.stickyRight]: StickyRightBlockView,
    [pmNodeNames.stickyLeft]: StickyLeftBlockView,
    [pmNodeNames.sideBySide]: SideBySideBlockView,
    [pmNodeNames.graySection]: GraySectionBlockView,
    [pmNodeNames.expandableParagraph]: ExpandableParagraphBlockView,
    [pmNodeNames.blockquote]: BlockquoteBlockView,
    [pmNodeNames.callout]: CalloutBlockView,
    [pmNodeNames.aside]: AsideBlockView,
}

export function RichEditor(props: {
    initialBody: OwidEnrichedGdocBlock[]
    editorRef: RefObject<Editor | null>
    /** Set to a function that opens the image picker and calls back with the chosen filename */
    requestImageRef?: RefObject<
        ((insert: (filename: string) => void) => void) | null
    >
    onDirty: () => void
    /** Restricts insertable blocks to those allowed in this document type */
    docType?: OwidGdocType
    /**
     * Live-collaboration state. When set, the Y.Doc is the source of the
     * document (initialBody is ignored) and undo/redo is per-client via Yjs.
     */
    collaboration?: RichEditorCollaboration | null
    onCreate?: (editor: Editor) => void
    onSelectionChange?: (editor: Editor) => void
}): React.ReactElement {
    const {
        initialBody,
        editorRef,
        requestImageRef,
        onDirty,
        docType,
        collaboration,
        onCreate,
        onSelectionChange,
    } = props

    // Set when a slash-menu "Image" command is waiting for the user to pick
    // an image from the library
    const [pendingImageInsert, setPendingImageInsert] = useState<
        ((filename: string) => void) | null
    >(null)
    // useEditor only reads the initial value; keep callbacks in refs
    const onDirtyRef = useRef(onDirty)
    onDirtyRef.current = onDirty
    const onCreateRef = useRef(onCreate)
    onCreateRef.current = onCreate
    const onSelectionChangeRef = useRef(onSelectionChange)
    onSelectionChangeRef.current = onSelectionChange
    if (requestImageRef) {
        requestImageRef.current = (insert) =>
            setPendingImageInsert(() => insert)
    }

    const extensions = useMemo((): Extensions => {
        const base = getRichEditorBaseExtensions({
            collaboration: !!collaboration,
        }).map((extension) => {
            const nodeView =
                NODE_VIEWS[extension.name as keyof typeof NODE_VIEWS]
            if (nodeView && extension.type === "node") {
                return (extension as Node).extend({
                    addNodeView: () => ReactNodeViewRenderer(nodeView),
                })
            }
            return extension
        })
        const collaborationExtensions: Extensions = []
        if (collaboration) {
            collaborationExtensions.push(
                Collaboration.configure({ document: collaboration.ydoc })
            )
            collaborationExtensions.push(
                CollaborationCaret.configure({
                    provider: collaboration.provider,
                    user: collaboration.user,
                })
            )
            const awareness = collaboration.provider.awareness
            if (awareness) {
                collaborationExtensions.push(
                    createRemoteBlockSelectionsExtension(awareness)
                )
            }
        }
        return [
            ...base,
            ...collaborationExtensions,
            BlockIdAssignment,
            CommentMark,
            SlashCommands.configure({
                onRequestImage: (insert) => setPendingImageInsert(() => insert),
                docType,
            }),
        ]
        // the editor schema is fixed after mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const initialDoc = useMemo(() => {
        // collaborating: the synced Y.Doc is the document, nothing to seed
        if (collaboration) return undefined
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
        // create the editor in an effect, not during render: binding an
        // already-synced collaboration doc fires update/selection callbacks
        // synchronously at creation, and those set parent state
        immediatelyRender: false,
        // transactions marked silent (e.g. applying comment highlights on
        // load) must not trigger the autosave loop
        onUpdate: ({ transaction }) => {
            if (!transaction.getMeta("richEditorSilent")) onDirtyRef.current()
        },
        onSelectionUpdate: ({ editor: current }) => {
            onSelectionChangeRef.current?.(current)
        },
        onCreate: ({ editor: created }) => {
            editorRef.current = created
            // useEditor creates the editor during render; both the id
            // assignment (dispatches a transaction, firing selection/update
            // callbacks) and the parent's onCreate set state, which React
            // forbids mid-render
            queueMicrotask(() => {
                if (editorRef.current !== created || created.isDestroyed) return
                ensureBlockIds(created)
                onCreateRef.current?.(created)
            })
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
