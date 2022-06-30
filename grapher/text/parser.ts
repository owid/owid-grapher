import P, { Language } from "parsimmon"

// An AST inspired by MDAST
// Deviates because we want to track individual words, whitespace, and newlines to use with TextWrap and our SVG exporter

// // type infer experiment below
// type Parser<ParsedType> = ParsedType extends P.Parser<infer ParsedType>
//     ? ParsedType
//     : never

interface ParsedFragmentBase {
    type: string
}

// The root literal that should be the leaf of every branch that isn't a newline or whitespace
interface Text {
    type: "text"
    value: string
}

const fallbackTextParser = (): P.Parser<Text> =>
    P.regex(/[^\s]+/).map((val) => ({ type: "text", value: val }))

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

interface PlainUrl {
    type: "plainUrl"
    href: string
}

const plainUrlParser = () =>
    P.regex(urlRegex).map(
        (result): PlainUrl => ({
            type: "plainUrl",
            href: result,
        })
    )

// https://urlregex.com
const urlRegex =
    /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/

const nonBracketWordParser: (r: MdParser) => P.Parser<NonBracketWord> = () =>
    P.regex(/[^\[\]\s]+/).map((val) => ({ type: "text", value: val })) //  no brackets, no WS

type NonBracketWord = Text

const nonParensWordParser: (r: MdParser) => P.Parser<NonParensWord> = () =>
    P.regex(/[^\(\)\s]+/).map((val) => ({ type: "text", value: val })) // no parens, no WS

type NonParensWord = Text

const nonDoubleColonOrParensWordParser: (
    r: MdParser
) => P.Parser<NonDoubleColonOrParensWord> = () =>
    P.regex(/([^\(\):\s]|:(?!:))+/).map((val) => ({ type: "text", value: val })) // no parens, no WS, no ::

type NonDoubleColonOrParensWord = Text

const nonSingleUnderscoreWordParser: (
    r: MdParser
) => P.Parser<NonSingleUnderscoreWord> = () =>
    P.regex(/[^_\s]+/).map((val) => ({ type: "text", value: val })) // no WS, no *

type NonSingleUnderscoreWord = Text

const nonDoubleStarWordParser: (
    r: MdParser
) => P.Parser<NonDoubleStarWord> = () =>
    P.regex(/([^*\s]|\*(?!\*))+/).map((val) => ({ type: "text", value: val })) // no WS, no **

type NonDoubleStarWord = Text
type MarkdownLinkContent = Whitespace | Newline | NonBracketWord

type DodCategory = Text

const dodCategoryParser: (r: MdParser) => P.Parser<DodCategory> = () =>
    P.regex(/([^\(\):\s]|:(?!:))+/).map((val) => ({
        type: "text",
        value: val,
    })) // no WS, no parens, no ::

type DodTerm = Text

const dodTermParser: (r: MdParser) => P.Parser<DodTerm> = () =>
    P.regex(/([^\(\):\s]|:(?!:))+/).map((val) => ({
        type: "text",
        value: val,
    })) // no WS, no parens, no ::

interface MarkdownLink {
    type: "markdownLink"
    children: MarkdownLinkContent[]
    href: string
}

// interface MarkdownLinkContent {
//     type: "markdownLinkContent"
//     value: Whitespace | Newline | NonBracketWord
// }

const markdownLinkContentParser: (
    r: MdParser
) => P.Parser<MarkdownLinkContent> = (r: MdParser) =>
    P.alt(
        // In TS 4.7 parsimmon could type the parser as Covariant on its type parameter which would remove the need for these casts
        r.whitespace as P.Parser<MarkdownLinkContent>,
        r.newline as P.Parser<MarkdownLinkContent>,
        r.nonBracketWord as P.Parser<MarkdownLinkContent>
    )

const markdownLinkParser: (r: MdParser) => P.Parser<MarkdownLink> = (
    r: MdParser
) =>
    P.seqObj<{ children: MarkdownLinkContent[]; href: string }>(
        P.string("["),
        [
            "children",
            r.markdownLinkContent /* as P.Parser<MarkdownLinkContent> */
                .atLeast(1),
        ],
        P.string("]("),
        ["href", P.regex(urlRegex)],
        P.string(")")
    ).map(({ children, href }) => ({
        type: "markdownLink",
        children,
        href,
    }))

type DetailsOnDemandContent =
    | Whitespace
    | Newline
    | PlainItalic
    | PlainBold
    | NonBracketWord

const detailOnDemandContentParser: (
    r: MdParser
) => P.Parser<DetailsOnDemandContent> = (r: MdParser) =>
    P.alt(
        // In TS 4.7 parsimmon could type the parser as Covariant on its type parameter which would remove the need for these casts
        r.whitespace,
        r.newline,
        r.plainBold,
        r.plainItalic,
        r.nonBracketWord
    )

interface DetailOnDemand {
    type: "detailOnDemand"
    category: string
    term: string
    children: DetailsOnDemandContent[]
}

const detailOnDemandParser: (r: MdParser) => P.Parser<DetailOnDemand> = (
    r: MdParser
) =>
    P.seqObj<{
        category: Text
        term: Text
        children: DetailsOnDemandContent[]
    }>(
        P.string("["),
        ["children", r.detailOnDemandContent.atLeast(1)],
        P.string("](hover::"),
        ["category", r.dodCategory],
        P.string("::"),
        ["term", r.dodTerm],
        P.string(")")
    ).map(({ children, category, term }) => ({
        type: "detailOnDemand",
        category: category.value,
        term: term.value,
        children,
    }))

type BoldWithoutItalicContent =
    | Whitespace
    | Newline
    | PlainUrl
    | MarkdownLink
    | DetailOnDemand
    | NonDoubleStarWord

const boldWithoutItalicContentParser: (
    r: MdParser
) => P.Parser<BoldWithoutItalicContent> = (r: MdParser) =>
    P.alt(
        r.whitespace,
        r.newline,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.nonDoubleStarWord
    )

interface BoldWithoutItalic {
    type: "boldWithoutItalic"
    children: BoldWithoutItalicContent[]
}

const boldWithoutItalicParser: (r: MdParser) => P.Parser<BoldWithoutItalic> = (
    r: MdParser
) =>
    P.seqObj<{ children: BoldWithoutItalicContent[] }>(
        P.string("**"),
        ["children", r.boldWithoutItalicContent.atLeast(1)],
        P.string("**")
    ).map(({ children }) => ({
        type: "boldWithoutItalic",
        children,
    }))

type BoldContent =
    | ItalicWithoutBold
    | Whitespace
    | Newline
    | PlainUrl
    | MarkdownLink
    | DetailOnDemand
    | NonDoubleStarWord

const boldContentParser: (r: MdParser) => P.Parser<BoldContent> = (
    r: MdParser
) =>
    P.alt(
        r.whitespace,
        r.newline,
        r.italicWithoutBold,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.nonDoubleStarWord
    )

interface Bold {
    type: "bold"
    children: BoldContent[]
}

const boldParser: (r: MdParser) => P.Parser<Bold> = (r: MdParser) =>
    P.seqObj<{ children: BoldContent[] }>(
        P.string("**"),
        ["children", r.boldContent.atLeast(1)],
        P.string("**")
    ).map(({ children }) => ({
        type: "bold",
        children,
    }))

type PlainBoldContent = Whitespace | Newline | NonDoubleStarWord

const plainBoldContentParser: (r: MdParser) => P.Parser<PlainBoldContent> = (
    r: MdParser
) => P.alt(r.whitespace, r.newline, r.nonDoubleStarWord)

interface PlainBold {
    type: "plainBold"
    children: PlainBoldContent[]
}

const plainBoldParser: (r: MdParser) => P.Parser<PlainBold> = (r: MdParser) =>
    P.seqObj<PlainBold>(
        P.string("**"),
        ["children", r.plainBoldContent.atLeast(1)],
        P.string("**")
    ).map(({ children }) => ({
        type: "plainBold",
        children,
    }))

type ItalicWithoutBoldContent =
    | Whitespace
    | Newline
    | PlainUrl
    | MarkdownLink
    | DetailOnDemand
    | NonSingleUnderscoreWord

const italicWithoutBoldContentParser: (
    r: MdParser
) => P.Parser<ItalicWithoutBoldContent> = (r: MdParser) =>
    P.alt(
        r.whitespace,
        r.newline,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.nonSingleUnderscoreWord
    )

interface ItalicWithoutBold {
    type: "italicWithoutBold"
    children: ItalicWithoutBoldContent[]
}

const italicWithoutBoldParser: (r: MdParser) => P.Parser<ItalicWithoutBold> = (
    r: MdParser
) =>
    P.seqObj<{ children: ItalicWithoutBoldContent[] }>(
        P.string("_"),
        ["children", r.italicWithoutBoldContent.atLeast(1)],
        P.string("_")
    ).map(({ children }) => ({
        type: "italicWithoutBold",
        children,
    }))
type ItalicContent =
    | BoldWithoutItalic
    | Whitespace
    | Newline
    | PlainUrl
    | MarkdownLink
    | DetailOnDemand
    | NonSingleUnderscoreWord

const italicContentParser: (r: MdParser) => P.Parser<ItalicContent> = (
    r: MdParser
) =>
    P.alt(
        r.whitespace,
        r.newline,
        r.boldWithoutItalic,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.nonSingleUnderscoreWord
    )

interface Italic {
    type: "italic"
    children: ItalicContent[]
}

const italicParser: (r: MdParser) => P.Parser<Italic> = (r: MdParser) =>
    P.seqObj<Italic>(
        P.string("_"),
        ["children", r.italicContent.atLeast(1)],
        P.string("_")
    ).map(({ children }) => ({
        type: "italic",
        children,
    }))

type PlainItalicContent = Whitespace | Newline | NonSingleUnderscoreWord
interface PlainItalic {
    type: "plainItalic"
    children: PlainItalicContent[]
}

const plainItalicContentParser: (
    r: MdParser
) => P.Parser<PlainItalicContent> = (r: MdParser) =>
    P.alt(r.whitespace, r.newline, r.nonSingleUnderscoreWord)

const plainItalicParser: (r: MdParser) => P.Parser<PlainItalic> = (
    r: MdParser
) =>
    P.seqObj<PlainItalic>(
        P.string("_"),
        ["children", r.plainItalicContent.atLeast(1)],
        P.string("_")
    ).map(({ children }) => ({
        type: "plainItalic",
        children,
    }))

// TODO: for inline bold and italic within a word we will probably need to
// have a different implementation for fallbackText that allows bold or italic
// to start in the middle of a word. The unused stuff below is from a sketch of
// thinking about this
const anyTextParser = P.regex(/"[^\s]+"/)

type InlineMarkup = PlainItalic | PlainBold

const inlineMarkupParser = (r: MdParser) => P.alt(r.plainBold, r.plainItalic)

const textParserWithInlineMarkup = (r: MdParser) =>
    P.alt(r.nonSingleUnderscoreWord, r.plainBold).atLeast(1)

type ParserConstructor = (r: MdParser) => P.Parser<ParsedFragmentBase>

interface DodMarkupRoot {
    type: "DodMarkupRoot"
    children: { type: string }[]
}

const markupTokensParser: (r: MdParser) => P.Parser<DodMarkupRoot> = (
    r: MdParser
) =>
    // The order is crucial here!

    P.alt(
        r.newline,
        r.whitespace,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.bold,
        r.italic,
        r.fallbackText
    )
        .atLeast(1)
        .map((tokens) => ({
            type: "DodMarkupRoot",
            children: tokens,
        }))

const languageParts = {
    markupTokens: markupTokensParser,
    newline: newlineParser,
    whitespace: whitespaceParser,
    detailOnDemand: detailOnDemandParser,
    markdownLink: markdownLinkParser,
    plainUrl: plainUrlParser,
    bold: boldParser,
    italic: italicParser,
    plainBold: plainBoldParser,
    plainItalic: plainItalicParser,
    fallbackText: fallbackTextParser,
    // Utility parsers below - these will never be tried on the top level because text covers everything else
    detailOnDemandContent: detailOnDemandContentParser,
    markdownLinkContent: markdownLinkContentParser,
    boldContent: boldContentParser,
    plainBoldContent: plainBoldContentParser,
    boldWithoutItalic: boldWithoutItalicParser,
    boldWithoutItalicContent: boldWithoutItalicContentParser,
    plainItalicContent: plainItalicContentParser,
    italicContent: italicContentParser,
    italicWithoutBold: italicWithoutBoldParser,
    italicWithoutBoldContent: italicWithoutBoldContentParser,
    nonBracketWord: nonBracketWordParser,
    nonParensWord: nonParensWordParser,
    nonDoubleColonOrParensWord: nonDoubleColonOrParensWordParser,
    nonDoubleStarWord: nonDoubleStarWordParser,
    nonSingleUnderscoreWord: nonSingleUnderscoreWordParser,
    dodCategory: dodCategoryParser,
    dodTerm: dodTermParser,
} as const

type languagePartsType = typeof languageParts

type MdParser = {
    [P in keyof languagePartsType]: ReturnType<languagePartsType[P]>
}

export const mdParser: MdParser = P.createLanguage(languageParts) as MdParser
