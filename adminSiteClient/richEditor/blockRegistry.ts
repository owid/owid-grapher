import { Editor, Range } from "@tiptap/core"
import { OwidGdocType } from "@ourworldindata/types"
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
    /** Document types this block can be inserted into; undefined = all */
    docTypes?: OwidGdocType[]
    command: (ctx: {
        editor: Editor
        range?: Range
        onRequestImage: (insert: (filename: string) => void) => void
    }) => void
}

// Data insights are a deliberately small surface: text, images and CTAs
// cover ~99% of production usage.
const ARTICLE_LIKE_TYPES = [
    OwidGdocType.Article,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
    OwidGdocType.AboutPage,
    OwidGdocType.Announcement,
    OwidGdocType.Fragment,
]

function deleteRangeIfAny(editor: Editor, range?: Range): void {
    if (range) editor.chain().focus().deleteRange(range).run()
}

export const richEditorBlockItems: RichEditorBlockItem[] = [
    {
        key: "heading",
        docTypes: ARTICLE_LIKE_TYPES,
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
        docTypes: ARTICLE_LIKE_TYPES,
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
        docTypes: ARTICLE_LIKE_TYPES,
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
        docTypes: ARTICLE_LIKE_TYPES,
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

function makeTwoColumnCommand(nodeType: string) {
    return ({ editor, range }: { editor: Editor; range?: Range }): void => {
        deleteRangeIfAny(editor, range)
        editor
            .chain()
            .focus()
            .insertContent({
                type: nodeType,
                content: [
                    {
                        type: pmNodeNames.layoutColumn,
                        attrs: { side: "left" },
                        content: [{ type: pmNodeNames.paragraph }],
                    },
                    {
                        type: pmNodeNames.layoutColumn,
                        attrs: { side: "right" },
                        content: [{ type: pmNodeNames.paragraph }],
                    },
                ],
            })
            .run()
    }
}

function makePropsAtomCommand(
    nodeType: string,
    defaultProps: Record<string, unknown>
) {
    return ({ editor, range }: { editor: Editor; range?: Range }): void => {
        deleteRangeIfAny(editor, range)
        editor
            .chain()
            .focus()
            .insertContent({
                type: nodeType,
                attrs: { props: structuredClone(defaultProps) },
            })
            .run()
    }
}

richEditorBlockItems.push(
    {
        key: "chart",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Chart",
        description: "Embed a Grapher chart",
        glyph: "📈",
        keywords: ["chart", "grapher", "graph", "figure", "data"],
        command: makePropsAtomCommand(pmNodeNames.chart, {
            url: "",
            size: "wide",
        }),
    },
    {
        key: "narrativeChart",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Narrative chart",
        description: "Embed a narrative chart by name",
        glyph: "📉",
        keywords: ["narrative", "chart", "view"],
        command: makePropsAtomCommand(pmNodeNames.narrativeChart, {
            name: "",
            size: "wide",
        }),
    },
    {
        key: "video",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Video",
        description: "Embedded video",
        glyph: "▶",
        keywords: ["video", "mp4", "film"],
        command: makePropsAtomCommand(pmNodeNames.video, {
            url: "",
            filename: "",
            shouldLoop: false,
            shouldAutoplay: false,
        }),
    },
    {
        key: "prominentLink",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Prominent link",
        description: "Highlighted link card",
        glyph: "🔗",
        keywords: ["link", "prominent", "card", "related"],
        command: makePropsAtomCommand(pmNodeNames.prominentLink, { url: "" }),
    },
    {
        key: "pullQuote",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Pull quote",
        description: "Large standalone quote",
        glyph: "❞",
        keywords: ["quote", "pull", "highlight"],
        command: makePropsAtomCommand(pmNodeNames.pullQuote, {
            quote: "",
            align: "left",
            content: [],
        }),
    },
    {
        key: "recirc",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Recirc",
        description: "Related-content box",
        glyph: "↻",
        keywords: ["recirc", "related", "links"],
        command: makePropsAtomCommand(pmNodeNames.recirc, {
            title: "Related content",
            links: [],
        }),
    },
    {
        key: "allCharts",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "All charts",
        description: "All charts for this topic",
        glyph: "▤",
        keywords: ["all charts", "topic"],
        command: makePropsAtomCommand(pmNodeNames.allCharts, {
            heading: "",
            top: [],
        }),
    },
    {
        key: "aside",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Aside",
        description: "Margin note next to the text",
        glyph: "¶",
        keywords: ["aside", "margin", "note"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor
                .chain()
                .focus()
                .insertContent({ type: pmNodeNames.aside })
                .run()
        },
    },
    {
        key: "graySection",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Gray section",
        description: "Shaded full-width section",
        glyph: "▦",
        keywords: ["gray", "grey", "section", "background"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor
                .chain()
                .focus()
                .insertContent({
                    type: pmNodeNames.graySection,
                    content: [{ type: pmNodeNames.paragraph }],
                })
                .run()
        },
    },
    {
        key: "expandableParagraph",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Expandable paragraph",
        description: "Collapsed section the reader can expand",
        glyph: "⌄",
        keywords: ["expandable", "collapse", "details"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor
                .chain()
                .focus()
                .insertContent({
                    type: pmNodeNames.expandableParagraph,
                    content: [{ type: pmNodeNames.paragraph }],
                })
                .run()
        },
    },
    {
        key: "stickyRight",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Sticky right",
        description: "Text left, sticky chart column right",
        glyph: "◨",
        keywords: ["sticky", "right", "columns", "layout"],
        command: makeTwoColumnCommand(pmNodeNames.stickyRight),
    },
    {
        key: "stickyLeft",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Sticky left",
        description: "Sticky column left, text right",
        glyph: "◧",
        keywords: ["sticky", "left", "columns", "layout"],
        command: makeTwoColumnCommand(pmNodeNames.stickyLeft),
    },
    {
        key: "sideBySide",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Side by side",
        description: "Two equal columns",
        glyph: "◫",
        keywords: ["side by side", "columns", "layout"],
        command: makeTwoColumnCommand(pmNodeNames.sideBySide),
    }
)

export function getBlockItemsForDocType(
    docType: OwidGdocType | undefined
): RichEditorBlockItem[] {
    if (!docType) return richEditorBlockItems
    return richEditorBlockItems.filter(
        (item) => !item.docTypes || item.docTypes.includes(docType)
    )
}

export function filterBlockItems(
    query: string,
    docType?: OwidGdocType
): RichEditorBlockItem[] {
    const items = getBlockItemsForDocType(docType)
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
        (item) =>
            item.title.toLowerCase().includes(q) ||
            item.keywords.some((keyword) => keyword.includes(q))
    )
}
