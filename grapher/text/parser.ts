import P from "parsimmon"

// An AST inspired by MDAST
// Deviates because we want to track individual words, whitespace, and newlines to use with TextWrap and our SVG exporter

// The root literal that should be the leaf of every branch that isn't a newline or whitespace
interface Text {
    type: "text"
    value: string
}

const characterRegex =
    /[!"#$%&'+,-.\/0123456789;<=>?\(\)ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz£­°±²³µ¹éü ‑–—‘’“”•⁵₀₁₂₃₄₅−≥ﬁ]+/

export const textParser = (): P.Parser<Text> =>
    P.regex(characterRegex).map((value) => ({ type: "text", value }))

// A special literal that we use when building lines with TextWrap
interface Newline {
    type: "newline"
}

const newlineParser = (): P.Parser<Newline> =>
    P.regex(/\n/).result({ type: "newline" })

// Another literal that's needed to know when to reinsert spaces (e.g. "**one**-two" versus "**one** -two")
interface Whitespace {
    type: "whitespace"
}

// A less greedy version of P.whitespace that doesn't consume newlines
const whitespaceParser = (): P.Parser<Whitespace> =>
    P.regex(/ +/).result({ type: "whitespace" })

interface Node {
    type: string
    children: (Text | Node | Whitespace | Newline)[]
}

type NodeType = "bold" | "italic" | "url" | "detailOnDemand"

interface MarkdownNode<T extends NodeType> extends Node {
    type: T
}

const boldParser = (r: P.Language): P.Parser<MarkdownNode<"bold">> =>
    P.seqObj<MarkdownNode<"bold">>(
        P.string("**"),
        ["children", r.value],
        P.string("**")
    ).map(({ children }) => ({
        type: "bold",
        children,
    }))

const italicParser = (r: P.Language): P.Parser<MarkdownNode<"italic">> =>
    P.seqObj<Node>(P.string("_"), ["children", r.value], P.string("_")).map(
        ({ children }) => ({
            type: "italic",
            children,
        })
    )

interface UrlNode extends MarkdownNode<"url"> {
    href: string
}

// https://urlregex.com
const urlRegex =
    /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/

const markdownUrlParser = (r: Language): P.Parser<UrlNode> =>
    P.seqObj<{ children: LanguageSpec["value"]; href: string }>(
        P.string("["),
        ["children", r.phrasing.many()],
        P.string("]("),
        ["href", P.regex(urlRegex)],
        P.string(")")
    ).map(({ children, href }) => ({
        type: "url",
        children,
        href,
    }))

const plainURLParser = (): P.Parser<UrlNode> =>
    P.regex(urlRegex).map((result) => ({
        type: "url",
        children: [{ type: "text", value: result }],
        href: result,
    }))

const urlParser = (r: Language): P.Parser<UrlNode> =>
    P.alt(markdownUrlParser(r), plainURLParser())

interface DetailOnDemandNode extends MarkdownNode<"detailOnDemand"> {
    category: string
    term: string
}

const detailOnDemandParser = (r: Language): P.Parser<DetailOnDemandNode> =>
    P.seqObj<{
        category: string
        term: string
        children: LanguageSpec["value"]
    }>(
        P.string("["),
        ["children", r.phrasing.many()],
        P.string("](hover::"),
        ["category", P.letters],
        P.string("::"),
        ["term", P.letters],
        P.string(")")
    ).map(({ children, category, term }) => ({
        type: "detailOnDemand",
        category,
        term,
        children,
    }))

interface LanguageSpec {
    text: Text
    bold: MarkdownNode<"bold">
    italic: MarkdownNode<"italic">
    whitespace: Whitespace
    newline: Newline
    url: UrlNode
    detailOnDemand: DetailOnDemandNode
    phrasing: Whitespace | MarkdownNode<"bold"> | MarkdownNode<"italic"> | Text
    wrappers: UrlNode | DetailOnDemandNode
    value: (
        | Newline
        | UrlNode
        | DetailOnDemandNode
        | Whitespace
        | MarkdownNode<"bold">
        | MarkdownNode<"italic">
        | Text
    )[]
}

type Language = P.TypedLanguage<LanguageSpec>

export const mdParser = P.createLanguage<LanguageSpec>({
    phrasing: (r) => P.alt(r.whitespace, r.bold, r.italic, r.text),
    wrappers: (r) => P.alt(r.detailOnDemand, r.url),
    newline: newlineParser,
    whitespace: whitespaceParser,
    text: textParser,
    bold: boldParser,
    italic: italicParser,
    detailOnDemand: detailOnDemandParser,
    url: urlParser,
    value: (r) => P.alt(r.newline, r.wrappers, r.phrasing).many(),
})
