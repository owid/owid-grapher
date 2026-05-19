import * as React from "react"
import Markdown, {
    type Options as MarkdownOptions,
    type Components as MarkdownComponents,
} from "react-markdown"
import { visit } from "unist-util-visit"
import type { Plugin } from "unified"
import type { Root } from "hast"
import type { Nodes } from "mdast"
import { DisplaySource } from "@ourworldindata/types"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { findAndReplace } from "mdast-util-find-and-replace"
import { formatSourceDate } from "@ourworldindata/utils"
import DetailedDetailsOnDemand from "./DetailedDetailsOnDemand.js"

type MetadataMarkdownTextProps = {
    text: string
    useParagraphs?: boolean // by default, text is wrapped in <p> tags
    sources?: DisplaySource[]
}

const DDOD_SOURCE_PREFIX = "#ddod/source:"

const urlRegex =
    /https?:\/\/([\w-]+\.)*[\w-]+(:\d+)?((\/[\p{L}\p{N}_\-.+/?:%&=~#]*[\p{L}\p{N}_\-+/%&=~#])|\/)?/gu

function remarkPlainLinks() {
    const turnIntoLink = (value: string) => {
        return {
            type: "link" as const,
            url: value,
            children: [
                {
                    type: "text" as const,
                    value: value,
                },
            ],
        }
    }
    return (tree: Nodes) => {
        findAndReplace(tree, [[urlRegex, turnIntoLink]])
    }
}

const transformDodLinks: Plugin<[], Root> = () => {
    return function (tree) {
        visit(tree, "element", function (node) {
            if (node.tagName === "a")
                if (
                    node.properties &&
                    typeof node.properties.href === "string" &&
                    node.properties.href.startsWith("#dod:")
                ) {
                    const match = node.properties.href.match(/#dod:(?<term>.+)/)
                    if (match) {
                        node.tagName = "span"
                        node.properties.class = "dod-span"
                        node.properties["data-id"] = match.groups?.term
                        node.properties["aria-expanded"] = "false"
                        node.properties["tabindex"] = 0
                        delete node.properties.href
                    }
                }
        })
    }
}

const normalizeForLookup = (text: string): string =>
    text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase()

const decodeSourceTerm = (href: string): string | undefined => {
    if (!href.startsWith(DDOD_SOURCE_PREFIX)) return undefined
    const rawTerm = href.slice(DDOD_SOURCE_PREFIX.length)
    if (!rawTerm) return undefined
    try {
        return decodeURIComponent(rawTerm.replace(/\+/g, " "))
    } catch {
        return rawTerm.replace(/\+/g, " ")
    }
}

const normalizeDdodSourceTerm = (rawTerm: string): string => {
    const trimmed = rawTerm.trim()
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return trimmed.slice(1, -1).trim()
    }
    return trimmed
}

// Markdown link destinations do not allow unescaped spaces. This converts
// `(#ddod/source:Some Source)` to `(#ddod/source:Some%20Source)` so authors
// can use readable terms in content.
const sanitizeDdodSourceLinks = (text: string): string => {
    return text.replace(
        /\(#ddod\/source:([^)]+)\)/g,
        (_fullMatch: string, rawTerm: string) => {
            const normalizedTerm = normalizeDdodSourceTerm(rawTerm)
            const decodedTerm = (() => {
                try {
                    return decodeURIComponent(normalizedTerm)
                } catch {
                    return normalizedTerm
                }
            })()
            return `(${DDOD_SOURCE_PREFIX}${encodeURIComponent(decodedTerm)})`
        }
    )
}

const findMatchingSource = (
    sources: DisplaySource[],
    term: string
): DisplaySource | undefined => {
    const termNorm = normalizeForLookup(term)
    return sources.find((source) => {
        const labelNorm = normalizeForLookup(source.label)
        if (labelNorm === termNorm) return true

        const fragments = labelNorm.split(" - ")
        return fragments.some((fragment) => fragment === termNorm)
    })
}

const flattenChildrenToText = (children: React.ReactNode): string => {
    return React.Children.toArray(children)
        .map((child) => {
            if (typeof child === "string" || typeof child === "number")
                return String(child)
            return ""
        })
        .join("")
        .trim()
}

const SourceLink = ({ href }: { href: string }): React.ReactElement => {
    const displayText = href.replace(/^https?:\/\//, "")
    return (
        <a href={href} target="_blank" rel="noreferrer">
            {displayText}
        </a>
    )
}

export const MetadataSingleSource = ({
    source,
}: {
    source: DisplaySource
}): React.ReactElement => {
    const retrievedOn = formatSourceDate(source.retrievedOn, "MMMM D, YYYY")
    const hasKeyData =
        source.dataPublishedBy || retrievedOn || source.retrievedFrom

    return (
        <div className="MetadataMarkdownText__single-source indicator-sources indicator-sources--single">
            <div className="source">
                {source.description && (
                    <div className="description">
                        <SimpleMarkdownText text={source.description.trim()} />
                    </div>
                )}
                {hasKeyData && (
                    <div className="source-key-data-blocks">
                        {source.dataPublishedBy && (
                            <div className="source-key-data source-key-data--span-2">
                                <div className="source-key-data__title">
                                    Data published by
                                </div>
                                <div className="source-key-data__content">
                                    <SimpleMarkdownText
                                        text={source.dataPublishedBy.trim()}
                                    />
                                </div>
                            </div>
                        )}
                        {(retrievedOn || source.retrievedFrom) && (
                            <div className="source-key-data source-key-data--span-2 source-key-data--retrieved">
                                <div className="source-key-data__content">
                                    {retrievedOn && source.retrievedFrom ? (
                                        <>
                                            Retrieved on {retrievedOn} from{" "}
                                            <SourceLink
                                                href={source.retrievedFrom}
                                            />
                                        </>
                                    ) : retrievedOn ? (
                                        <>Retrieved on {retrievedOn}</>
                                    ) : (
                                        <>
                                            Retrieved from{" "}
                                            <SourceLink
                                                href={source.retrievedFrom!}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {source.citation && (
                    <div className="source-key-data-blocks">
                        <div className="source-key-data source-key-data-citation source-key-data--span-2">
                            <div className="source-key-data__title">
                                Source attribution
                            </div>
                            <div className="source-key-data__content">
                                <SimpleMarkdownText
                                    text={source.citation.trim()}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

const MetadataDdodSourceLink = ({
    href,
    children,
    sources,
}: {
    href: string
    children: React.ReactNode
    sources: DisplaySource[]
}): React.ReactElement => {
    const term = decodeSourceTerm(href)
    if (!term) return <a href={href}>{children}</a>

    const source = findMatchingSource(sources, term)
    if (!source) return <a href={href}>{children}</a>

    const triggerText = flattenChildrenToText(children) || source.label

    return (
        <DetailedDetailsOnDemand
            title={source.label}
            triggerText={triggerText}
            triggerClassName="MetadataMarkdownText__source-trigger"
        >
            <div className="MetadataMarkdownText__source-content">
                <MetadataSingleSource source={source} />
            </div>
        </DetailedDetailsOnDemand>
    )
}

// SimpleMarkdownText variant used by MetadataSectionOnion. Adds support
// for `#ddod/source:<label>` links that open a per-source modal via
// DetailedDetailsOnDemand, plus the standard #dod: span rewrite.
export class MetadataMarkdownText extends React.Component<MetadataMarkdownTextProps> {
    get useParagraphs(): boolean {
        return this.props.useParagraphs ?? true
    }

    get markdownCustomComponents(): MarkdownComponents | undefined {
        const components: MarkdownComponents = {
            a: ({ href, children }) => {
                if (
                    typeof href === "string" &&
                    href.startsWith(DDOD_SOURCE_PREFIX) &&
                    this.props.sources
                ) {
                    return (
                        <MetadataDdodSourceLink
                            href={href}
                            sources={this.props.sources}
                        >
                            {children}
                        </MetadataDdodSourceLink>
                    )
                }
                return <a href={href}>{children}</a>
            },
        }

        if (!this.useParagraphs) {
            components.p = ({ children }) => (
                <React.Fragment>{children}</React.Fragment>
            )
        }

        return components
    }

    override render(): React.ReactElement | null {
        const sanitizedText = sanitizeDdodSourceLinks(this.props.text)
        const options: Omit<MarkdownOptions, "children"> = {
            rehypePlugins: [transformDodLinks],
            remarkPlugins: [remarkPlainLinks],
            components: this.markdownCustomComponents,
        }
        return <Markdown {...options}>{sanitizedText}</Markdown>
    }
}

export const MetadataHtmlOrSimpleMarkdownText = (props: {
    text: string
    sources?: DisplaySource[]
}): React.ReactElement => {
    const { text, sources } = props
    const htmlRegex = /<\/(a|li|p)>/
    const match = text.match(htmlRegex)
    if (match) {
        return <span dangerouslySetInnerHTML={{ __html: text }} />
    } else {
        return <MetadataMarkdownText text={text} sources={sources} />
    }
}
