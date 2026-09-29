import { Editor, Range } from "@tiptap/core"
import { OwidGdocType } from "@ourworldindata/types"
import { pmNodeNames } from "../../adminShared/richEditor/serialization/pmJson.js"

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
    OwidGdocType.Author,
    OwidGdocType.Profile,
]

// Blocks that only make sense on (linear) topic pages
const TOPIC_PAGE_TYPES = [OwidGdocType.TopicPage, OwidGdocType.LinearTopicPage]

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

/** Insert a props container seeded with one empty paragraph */
function makePropsContainerCommand(
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
                content: [{ type: pmNodeNames.paragraph }],
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
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor
                .chain()
                .focus()
                .insertContent({
                    type: pmNodeNames.pullQuote,
                    attrs: { quote: "", align: "left" },
                    // seed the attribution area so there is somewhere to type
                    content: [{ type: pmNodeNames.paragraph }],
                })
                .run()
        },
    },
    {
        key: "table",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Table",
        description: "Table with editable cells",
        glyph: "⊞",
        keywords: ["table", "grid", "cells", "rows"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            const cell = (): Record<string, unknown> => ({
                type: pmNodeNames.tableCell,
                content: [{ type: pmNodeNames.paragraph }],
            })
            const row = (): Record<string, unknown> => ({
                type: pmNodeNames.tableRow,
                content: [cell(), cell(), cell()],
            })
            editor
                .chain()
                .focus()
                .insertContent({
                    type: pmNodeNames.tableBlock,
                    attrs: { template: "header-row", size: "narrow" },
                    content: [row(), row(), row()],
                })
                .run()
        },
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
        key: "keyInsights",
        docTypes: TOPIC_PAGE_TYPES,
        title: "Key insights",
        description: "Slide deck of key insights for a topic",
        glyph: "★",
        keywords: ["key insights", "slides", "insights"],
        command: ({ editor, range }) => {
            deleteRangeIfAny(editor, range)
            editor
                .chain()
                .focus()
                .insertContent({
                    type: pmNodeNames.keyInsights,
                    attrs: { props: { heading: "Key insights" } },
                    content: [
                        {
                            type: pmNodeNames.keyInsightSlide,
                            attrs: { props: { title: "" } },
                            content: [{ type: pmNodeNames.paragraph }],
                        },
                    ],
                })
                .run()
        },
    },
    {
        key: "explorerTiles",
        docTypes: TOPIC_PAGE_TYPES,
        title: "Explorer tiles",
        description: "Grid of data explorer links",
        glyph: "⚏",
        keywords: ["explorer", "tiles", "grid"],
        command: makePropsAtomCommand(pmNodeNames.explorerTiles, {
            title: "",
            subtitle: "",
            explorers: [],
        }),
    },
    {
        key: "pillRow",
        docTypes: TOPIC_PAGE_TYPES,
        title: "Pill row",
        description: "Row of pill-shaped links",
        glyph: "▭",
        keywords: ["pill", "row", "links"],
        command: makePropsAtomCommand(pmNodeNames.pillRow, {
            title: "",
            pills: [],
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
    },
    {
        key: "expander",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Expander",
        description: "Titled box the reader can expand",
        glyph: "▸",
        keywords: ["expander", "collapse", "details", "accordion", "faq"],
        command: makePropsContainerCommand(pmNodeNames.expander, {
            title: "",
        }),
    },
    {
        key: "topicPageIntro",
        docTypes: TOPIC_PAGE_TYPES,
        title: "Topic page intro",
        description: "Intro text with related topics and download button",
        glyph: "¶",
        keywords: ["topic", "intro", "introduction"],
        command: makePropsContainerCommand(pmNodeNames.topicPageIntro, {}),
    },
    {
        key: "pullChart",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Pull chart",
        description: "Chart image with a text column beside it",
        glyph: "◪",
        keywords: ["pull", "chart", "image", "feature"],
        command: makePropsContainerCommand(pmNodeNames.pullChart, {
            image: "",
            url: "",
        }),
    },
    {
        key: "dataCallout",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Data callout",
        description: "Text block calling out a chart's data",
        glyph: "◈",
        keywords: ["data", "callout", "highlight"],
        command: makePropsContainerCommand(pmNodeNames.dataCallout, {
            url: "",
        }),
    },
    {
        key: "guidedChart",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Guided chart",
        description: "Text with links that drive an embedded chart",
        glyph: "➲",
        keywords: ["guided", "chart", "interactive"],
        command: makePropsContainerCommand(pmNodeNames.guidedChart, {}),
    },
    {
        key: "chartStory",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Chart story",
        description: "Step-by-step story told through charts",
        glyph: "▶▶",
        keywords: ["chart", "story", "steps", "slideshow"],
        command: makePropsAtomCommand(pmNodeNames.chartStory, { items: [] }),
    },
    {
        key: "staticViz",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Static visualization",
        description: "Pre-rendered visualization by name",
        glyph: "◍",
        keywords: ["static", "viz", "visualization", "svg"],
        command: makePropsAtomCommand(pmNodeNames.staticViz, {
            name: "",
            size: "wide",
            hasOutline: false,
        }),
    },
    {
        key: "html",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "HTML",
        description: "Raw HTML embed (advanced)",
        glyph: "</>",
        keywords: ["html", "embed", "iframe", "raw"],
        command: makePropsAtomCommand(pmNodeNames.html, { value: "" }),
    },
    {
        key: "code",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Code",
        description: "Monospaced code block",
        glyph: "{}",
        keywords: ["code", "monospace", "snippet"],
        command: makePropsAtomCommand(pmNodeNames.codeBlock, { text: [] }),
    },
    {
        key: "resourcePanel",
        docTypes: TOPIC_PAGE_TYPES,
        title: "Resource panel",
        description: "Sidebar panel of key resources",
        glyph: "▤",
        keywords: ["resource", "panel", "links", "sidebar"],
        command: makePropsAtomCommand(pmNodeNames.resourcePanel, {
            title: "",
            links: [],
        }),
    },
    {
        key: "conditionalSection",
        docTypes: [OwidGdocType.Profile],
        title: "Conditional section",
        description: "Section shown only for some profile entities",
        glyph: "⋔",
        keywords: ["conditional", "section", "profile", "include", "exclude"],
        command: makePropsContainerCommand(pmNodeNames.conditionalSection, {
            include: [],
            exclude: [],
        }),
    },
    {
        key: "socials",
        docTypes: [OwidGdocType.Author],
        title: "Social links",
        description: "Row of social media links",
        glyph: "@",
        keywords: ["social", "twitter", "mastodon", "links"],
        command: makePropsAtomCommand(pmNodeNames.socials, { links: [] }),
    },
    {
        key: "peopleRows",
        docTypes: [OwidGdocType.AboutPage],
        title: "People rows",
        description: "Grid of team members",
        glyph: "◉◉",
        keywords: ["people", "team", "person", "staff"],
        command: makePropsAtomCommand(pmNodeNames.peopleRows, {
            columns: "4",
            people: [],
        }),
    },
    {
        key: "subscribeBanner",
        docTypes: ARTICLE_LIKE_TYPES,
        title: "Subscribe banner",
        description: "Newsletter subscription call-out",
        glyph: "✉",
        keywords: ["subscribe", "newsletter", "banner"],
        command: makePropsAtomCommand(pmNodeNames.subscribeBanner, {
            align: "left",
        }),
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
