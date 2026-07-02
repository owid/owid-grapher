import { Editor, Range } from "@tiptap/core"
import { pmNodeNames } from "./serialization/pmJson.js"

// The insertable block types, ranked by real-world usage per document type
// (see devTools/richEditor and the project plan). Powers both the slash menu
// and the insert palette.

export interface RichEditorBlockItem {
    key: string
    title: string
    description: string
    /** Monochrome glyph shown in menus */
    glyph: string
    keywords: string[]
    command: (ctx: {
        editor: Editor
        range?: Range
        onRequestImage: (insert: (filename: string) => void) => void
    }) => void
}

function deleteRangeIfAny(editor: Editor, range?: Range): void {
    if (range) editor.chain().focus().deleteRange(range).run()
}

export const richEditorBlockItems: RichEditorBlockItem[] = [
    {
        key: "heading",
        title: "Heading",
        description: "Section heading",
        glyph: "H",
        keywords: ["heading", "title", "h1", "h2", "h3"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor
                .chain()
                .focus()
                .setNode(pmNodeNames.heading, { level: 2 })
                .run()
        },
    },
    {
        key: "image",
        title: "Image",
        description: "Image from the library",
        glyph: "▣",
        keywords: ["image", "picture", "photo", "figure"],
        command: ({ editor, range, onRequestImage }) => {
            deleteRangeIfAny(editor, range)
            onRequestImage((filename) => {
                editor
                    .chain()
                    .focus()
                    .insertContent({
                        type: pmNodeNames.image,
                        attrs: { filename, size: "wide", hasOutline: false },
                    })
                    .run()
            })
        },
    },
    {
        key: "cta",
        title: "Call to action",
        description: "Button linking to a page",
        glyph: "↗",
        keywords: ["cta", "button", "call to action", "link"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor
                .chain()
                .focus()
                .insertContent({
                    type: pmNodeNames.cta,
                    attrs: { text: "Explore the data", url: "" },
                })
                .run()
        },
    },
    {
        key: "bulletList",
        title: "Bulleted list",
        description: "Simple list",
        glyph: "•",
        keywords: ["list", "bullet", "unordered"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor.chain().focus().toggleBulletList().run()
        },
    },
    {
        key: "orderedList",
        title: "Numbered list",
        description: "Ordered list",
        glyph: "1.",
        keywords: ["list", "numbered", "ordered"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor.chain().focus().toggleOrderedList().run()
        },
    },
    {
        key: "blockquote",
        title: "Quote",
        description: "Block quotation with optional citation",
        glyph: "❝",
        keywords: ["quote", "blockquote", "citation"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor.chain().focus().wrapIn(pmNodeNames.blockquote).run()
        },
    },
    {
        key: "callout",
        title: "Callout",
        description: "Highlighted info box",
        glyph: "!",
        keywords: ["callout", "info", "note", "box"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor.chain().focus().wrapIn(pmNodeNames.callout).run()
        },
    },
    {
        key: "horizontalRule",
        title: "Divider",
        description: "Horizontal rule",
        glyph: "—",
        keywords: ["divider", "rule", "separator", "hr"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor
                .chain()
                .focus()
                .insertContent({ type: pmNodeNames.horizontalRule })
                .run()
        },
    },
]

export function filterBlockItems(query: string): RichEditorBlockItem[] {
    const q = query.trim().toLowerCase()
    if (!q) return richEditorBlockItems
    return richEditorBlockItems.filter(
        (item) =>
            item.title.toLowerCase().includes(q) ||
            item.keywords.some((keyword) => keyword.includes(q))
    )
}
