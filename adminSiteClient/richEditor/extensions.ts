import {
    Extensions,
    Mark,
    Node,
    textblockTypeInputRule,
    wrappingInputRule,
} from "@tiptap/core"
import { StarterKit } from "@tiptap/starter-kit"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { pmMarkNames, pmNodeNames } from "./serialization/pmJson.js"

// The TipTap extensions defining the rich editor's document schema. This
// module must stay headless-safe (no React imports): it is used both by the
// editor and by node-side scripts that validate serialized documents against
// the schema. NodeViews are attached in the editor by extending these nodes.

// `block*` rather than the default `block+`: empty documents exist in
// production (fragments used as pure front-matter containers)
const OwidDocument = Node.create({
    name: pmNodeNames.doc,
    topNode: true,
    content: "block*",
})

const OwidHeading = Node.create({
    name: pmNodeNames.heading,
    group: "block",
    content: "inline*",
    defining: true,
    addAttributes() {
        return {
            level: { default: 1 },
            // Span[] carried opaquely for now; not editable in the canvas yet
            supertitle: { default: null },
        }
    },
    parseHTML() {
        return [1, 2, 3, 4, 5, 6].map((level) => ({
            tag: `h${level}`,
            attrs: { level },
        }))
    },
    renderHTML({ node }) {
        const level = Number(node.attrs.level) || 1
        return [`h${Math.min(Math.max(level, 1), 6)}`, 0]
    },
    addInputRules() {
        // "# ", "## ", ... at the start of a block turns it into a heading
        return [1, 2, 3, 4, 5].map((level) =>
            textblockTypeInputRule({
                find: new RegExp(`^(#{${level}})\\s$`),
                type: this.type,
                getAttributes: { level },
            })
        )
    },
})

const OwidBlockquote = Node.create({
    name: pmNodeNames.blockquote,
    group: "block",
    content: "paragraph+",
    defining: true,
    addAttributes() {
        return { citation: { default: null } }
    },
    parseHTML() {
        return [{ tag: "blockquote" }]
    },
    renderHTML() {
        return ["blockquote", 0]
    },
    addInputRules() {
        return [wrappingInputRule({ find: /^\s*>\s$/, type: this.type })]
    },
})

const OwidCallout = Node.create({
    name: pmNodeNames.callout,
    group: "block",
    content: "(paragraph | heading | bulletList)*",
    defining: true,
    addAttributes() {
        return { icon: { default: null }, title: { default: null } }
    },
    parseHTML() {
        return [{ tag: "aside[data-rich-callout]" }]
    },
    renderHTML() {
        return ["aside", { "data-rich-callout": "", class: "rich-callout" }, 0]
    },
})

const OwidImage = Node.create({
    name: pmNodeNames.image,
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            filename: { default: "" },
            smallFilename: { default: null },
            alt: { default: null },
            caption: { default: null },
            originalWidth: { default: null },
            size: { default: "wide" },
            hasOutline: { default: false },
            visibility: { default: null },
            preferSmallFilename: { default: null },
        }
    },
    parseHTML() {
        return [{ tag: "figure[data-rich-image]" }]
    },
    renderHTML({ node }) {
        return [
            "figure",
            { "data-rich-image": "", class: "rich-image" },
            ["span", {}, String(node.attrs.filename ?? "")],
        ]
    },
})

const OwidCta = Node.create({
    name: pmNodeNames.cta,
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
        return { text: { default: "" }, url: { default: "" } }
    },
    parseHTML() {
        return [{ tag: "div[data-rich-cta]" }]
    },
    renderHTML({ node }) {
        return [
            "div",
            { "data-rich-cta": "", class: "rich-cta" },
            String(node.attrs.text ?? ""),
        ]
    },
})

const OwidRawBlock = Node.create({
    name: pmNodeNames.rawBlock,
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
        return { block: { default: null } }
    },
    parseHTML() {
        return [{ tag: "div[data-rich-raw-block]" }]
    },
    renderHTML({ node }) {
        const block = node.attrs.block as { type?: string } | null
        return [
            "div",
            { "data-rich-raw-block": "", class: "rich-raw-block" },
            `[${block?.type ?? "unknown"}]`,
        ]
    },
})

const OwidSpanCallout = Node.create({
    name: pmNodeNames.spanCallout,
    group: "inline",
    inline: true,
    atom: true,
    marks: "_",
    addAttributes() {
        return {
            functionName: { default: "latestValue" },
            parameters: { default: [] },
            children: { default: [] },
        }
    },
    parseHTML() {
        return [{ tag: "span[data-rich-span-callout]" }]
    },
    renderHTML({ node }) {
        return [
            "span",
            { "data-rich-span-callout": "", class: "rich-span-callout" },
            `{${String(node.attrs.functionName)}}`,
        ]
    },
})

function createUrlMark(name: string, className: string): Mark {
    return Mark.create({
        name,
        addAttributes() {
            return { url: { default: "" } }
        },
        parseHTML() {
            return [{ tag: `a[data-rich-mark="${name}"]` }]
        },
        renderHTML({ mark }) {
            return [
                "a",
                {
                    "data-rich-mark": name,
                    class: className,
                    href: String(mark.attrs.url ?? ""),
                },
                0,
            ]
        },
    })
}

const OwidLink = createUrlMark(pmMarkNames.link, "rich-link")
const OwidRef = createUrlMark(pmMarkNames.ref, "rich-ref")
const OwidGuidedChartLink = createUrlMark(
    pmMarkNames.guidedChartLink,
    "rich-guided-chart-link"
)

const OwidDod = Mark.create({
    name: pmMarkNames.dod,
    addAttributes() {
        return { id: { default: "" } }
    },
    parseHTML() {
        return [{ tag: `span[data-rich-mark="${pmMarkNames.dod}"]` }]
    },
    renderHTML({ mark }) {
        return [
            "span",
            {
                "data-rich-mark": pmMarkNames.dod,
                class: "rich-dod",
                "data-dod-id": String(mark.attrs.id ?? ""),
            },
            0,
        ]
    },
})

const OwidSpanQuote = Mark.create({
    name: pmMarkNames.spanQuote,
    parseHTML() {
        return [{ tag: `q[data-rich-mark="${pmMarkNames.spanQuote}"]` }]
    },
    renderHTML() {
        return ["q", { "data-rich-mark": pmMarkNames.spanQuote }, 0]
    },
})

const OwidSpanFallback = Mark.create({
    name: pmMarkNames.spanFallback,
    parseHTML() {
        return [{ tag: `span[data-rich-mark="${pmMarkNames.spanFallback}"]` }]
    },
    renderHTML() {
        return ["span", { "data-rich-mark": pmMarkNames.spanFallback }, 0]
    },
})

/**
 * The schema-defining extensions, shared between the editor (which layers
 * NodeViews and interaction extensions on top) and headless validation.
 */
export function getRichEditorBaseExtensions(): Extensions {
    return [
        StarterKit.configure({
            document: false,
            heading: false,
            blockquote: false,
            link: false,
            code: false,
            codeBlock: false,
            strike: false,
            // hard breaks may carry formatting marks (span-newline inside
            // formatting spans)
            hardBreak: { keepMarks: true },
        }),
        OwidDocument,
        OwidHeading,
        OwidBlockquote,
        OwidCallout,
        OwidImage,
        OwidCta,
        OwidRawBlock,
        OwidSpanCallout,
        Subscript,
        Superscript,
        OwidLink,
        OwidRef,
        OwidGuidedChartLink,
        OwidDod,
        OwidSpanQuote,
        OwidSpanFallback,
    ]
}
