import * as cheerio from "cheerio"
import type { AnyNode, Element } from "domhandler"
import { match } from "ts-pattern"
import {
    Span,
    OwidRawGdocBlock,
    OwidEnrichedGdocBlock,
    RawBlockText,
    RawBlockHeading,
    RawBlockChart,
    RawBlockNarrativeChart,
    RawBlockImage,
    RawBlockVideo,
    RawBlockStaticViz,
    RawBlockList,
    RawBlockNumberedList,
    RawBlockAside,
    RawBlockCallout,
    RawBlockBlockquote,
    RawBlockPullQuote,
    RawBlockCode,
    RawBlockHtml,
    RawBlockScript,
    RawBlockTable,
    RawBlockSideBySideContainer,
    RawBlockStickyLeftContainer,
    RawBlockStickyRightContainer,
    RawBlockGraySection,
    RawBlockExploreDataSection,
    RawBlockAlign,
    RawBlockExpandableParagraph,
    RawBlockExpander,
    RawBlockGuidedChart,
    RawBlockProminentLink,
    RawBlockRecirc,
    RawBlockKeyInsights,
    RawBlockKeyIndicator,
    RawBlockKeyIndicatorCollection,
    RawBlockAdditionalCharts,
    RawBlockAllCharts,
    RawBlockDonorList,
    RawBlockSDGGrid,
    RawBlockSDGToc,
    RawBlockLTPToc,
    RawBlockMissingData,
    RawBlockChartStory,
    RawBlockTopicPageIntro,
    RawBlockResearchAndWriting,
    RawBlockEntrySummary,
    RawBlockExplorerTiles,
    RawBlockPillRow,
    RawBlockHomepageSearch,
    RawBlockHomepageIntro,
    RawBlockFeaturedMetrics,
    RawBlockFeaturedDataInsights,
    RawBlockLatestDataInsights,
    RawBlockCookieNotice,
    RawBlockSubscribeBanner,
    RawBlockCta,
    RawBlockSocials,
    RawBlockPeople,
    RawBlockPerson,
    RawBlockPeopleRows,
    RawBlockResourcePanel,
    RawSocialLink,
    BlockSize,
    ResearchAndWritingVariant,
    excludeNullish,
} from "@ourworldindata/utils"
import { parseRawBlocksToEnrichedBlocks } from "./rawToEnriched.js"

/**
 * Error thrown when parsing XHTML encounters an unknown block type.
 */
export class XhtmlParseError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "XhtmlParseError"
    }
}

/**
 * Convert XHTML element children to spans.
 */
function nodeToSpan(node: AnyNode): Span | undefined {
    if (node.type === "text") {
        const text = (node as unknown as { data: string }).data
        return { spanType: "span-simple-text", text }
    }

    if (node.type !== "tag") return undefined

    const element = node as Element
    const tag = element.tagName.toLowerCase()
    const children = element.children ?? []

    return match(tag)
        .with("b", () => ({
            spanType: "span-bold" as const,
            children: nodesToSpans(children),
        }))
        .with("i", () => ({
            spanType: "span-italic" as const,
            children: nodesToSpans(children),
        }))
        .with("u", () => ({
            spanType: "span-underline" as const,
            children: nodesToSpans(children),
        }))
        .with("sub", () => ({
            spanType: "span-subscript" as const,
            children: nodesToSpans(children),
        }))
        .with("sup", () => ({
            spanType: "span-superscript" as const,
            children: nodesToSpans(children),
        }))
        .with("a", () => ({
            spanType: "span-link" as const,
            children: nodesToSpans(children),
            url: element.attribs.href ?? "",
        }))
        .with("ref", () => ({
            spanType: "span-ref" as const,
            children: nodesToSpans(children),
            url: element.attribs.url ?? "",
        }))
        .with("dod", () => ({
            spanType: "span-dod" as const,
            children: nodesToSpans(children),
            id: element.attribs.id ?? "",
        }))
        .with("glink", () => ({
            spanType: "span-guided-chart-link" as const,
            children: nodesToSpans(children),
            url: element.attribs.url ?? "",
        }))
        .with("q", () => ({
            spanType: "span-quote" as const,
            children: nodesToSpans(children),
        }))
        .with("br", () => ({
            spanType: "span-newline" as const,
        }))
        .otherwise(() => {
            // Unknown span element - treat as fallback
            return {
                spanType: "span-fallback" as const,
                children: nodesToSpans(children),
            }
        })
}

/**
 * Convert an array of DOM nodes to spans.
 */
function nodesToSpans(nodes: AnyNode[]): Span[] {
    return excludeNullish(nodes.map(nodeToSpan))
}

/**
 * Convert XHTML string containing span markup to Span array.
 */
export function xhtmlToSpans(xhtml: string): Span[] {
    const $ = cheerio.load(xhtml, { xml: true })
    const body =
        $("body").length > 0 ? $("body").contents() : $.root().contents()
    return nodesToSpans(body.toArray() as AnyNode[])
}

/**
 * Check if a text string is only whitespace (spaces, tabs, newlines).
 */
function isWhitespaceOnly(text: string): boolean {
    return /^\s*$/.test(text)
}

/**
 * Get text content of an element, converting spans to HTML for raw blocks.
 * This is needed because raw blocks store spans as HTML strings that get parsed later.
 * Handles whitespace normalization to support pretty-printed XHTML input.
 */
function getSpanContent(element: Element): string {
    // Helper to process children with whitespace handling for pretty-printed XHTML
    const processChildren = (children: AnyNode[]): string => {
        return children
            .map((child, index, arr) => {
                if (child.type === "text") {
                    const text = (child as unknown as { data: string }).data
                    // Skip whitespace-only text nodes that contain newlines between elements.
                    // These are artifacts of pretty-printing indentation.
                    // Preserve single spaces between elements as they may be actual content.
                    if (isWhitespaceOnly(text) && text.includes("\n")) {
                        const prevIsTag =
                            index > 0 && arr[index - 1].type === "tag"
                        const nextIsTag =
                            index < arr.length - 1 &&
                            arr[index + 1].type === "tag"
                        if (prevIsTag || nextIsTag) {
                            return ""
                        }
                    }
                    // Preserve text content as-is (don't normalize whitespace)
                    // to maintain round-trip fidelity with the original content
                    return text
                }
                if (child.type === "tag") {
                    return convertSpans(child as Element)
                }
                return ""
            })
            .join("")
    }

    // Convert our XHTML span format back to HTML format expected by htmlToSpans
    const convertSpans = (el: Element): string => {
        const children = el.children ?? []
        const childContent = processChildren(children)

        const tag = el.tagName?.toLowerCase()
        if (!tag) return childContent

        return match(tag)
            .with("b", () => `<b>${childContent}</b>`)
            .with("i", () => `<i>${childContent}</i>`)
            .with("u", () => `<u>${childContent}</u>`)
            .with("sub", () => `<sub>${childContent}</sub>`)
            .with("sup", () => `<sup>${childContent}</sup>`)
            .with(
                "a",
                () => `<a href="${el.attribs.href ?? ""}">${childContent}</a>`
            )
            .with(
                "ref",
                () =>
                    `<a class="ref" href="${el.attribs.url ?? ""}">${childContent}</a>`
            )
            .with(
                "dod",
                () =>
                    `<a href="#dod:${el.attribs.id ?? ""}">${childContent}</a>`
            )
            .with(
                "glink",
                () =>
                    `<a href="#guide:${el.attribs.url ?? ""}">${childContent}</a>`
            )
            .with("q", () => `<q>${childContent}</q>`)
            .with("br", () => "<br>")
            .otherwise(() => childContent)
    }

    // Don't trim the result - trailing/leading spaces may be intentional content.
    // Pretty-printing whitespace is already handled by skipping whitespace-only
    // nodes that contain newlines.
    return processChildren(element.children ?? [])
}

/**
 * Get all child elements with a specific tag name.
 */
function getChildElements(element: Element, tagName: string): Element[] {
    return (element.children ?? []).filter(
        (child) =>
            child.type === "tag" &&
            (child as Element).tagName.toLowerCase() === tagName
    ) as Element[]
}

/**
 * Get the first child element with a specific tag name.
 */
function getChildElement(
    element: Element,
    tagName: string
): Element | undefined {
    return getChildElements(element, tagName)[0]
}

/**
 * Get all child elements (any tag).
 */
function getAllChildElements(element: Element): Element[] {
    return (element.children ?? []).filter(
        (child) => child.type === "tag"
    ) as Element[]
}

/**
 * Get text content from direct text children only.
 */
function getDirectTextContent(element: Element): string {
    return (element.children ?? [])
        .filter((child) => child.type === "text")
        .map((child) => (child as unknown as { data: string }).data)
        .join("")
}

/**
 * Convert a person element to a RawBlockPerson.
 */
function elementToRawPerson(element: Element): RawBlockPerson {
    const socialsEl = getChildElement(element, "socials")
    const textElements = getAllChildElements(element).filter(
        (el) => el.tagName.toLowerCase() !== "socials"
    )

    return {
        type: "person",
        value: {
            name: element.attribs.name,
            image: element.attribs.image,
            title: element.attribs.title,
            url: element.attribs.url,
            text: textElements.map((el) => ({
                type: "text" as const,
                value: getSpanContent(el),
            })),
            socials: socialsEl
                ? (getChildElements(socialsEl, "social").map((s) => ({
                      url: s.attribs.url,
                      text: s.attribs.text,
                      type: s.attribs.type,
                  })) as RawSocialLink[])
                : undefined,
        },
    }
}

/**
 * Convert a single XHTML element to a raw block.
 * Throws XhtmlParseError for unknown block types.
 */
function elementToRawBlock(element: Element): OwidRawGdocBlock {
    const tag = element.tagName.toLowerCase()
    const attribs = element.attribs ?? {}

    return match(tag)
        .with(
            "text",
            (): RawBlockText => ({
                type: "text",
                value: getSpanContent(element),
            })
        )
        .with(
            "simple-text",
            (): RawBlockText => ({
                type: "text",
                value: getDirectTextContent(element),
            })
        )
        .with(
            "heading",
            (): RawBlockHeading => ({
                type: "heading",
                value: {
                    // The raw format uses \v (vertical tab) to separate supertitle from title
                    // Format: supertitle\vtitle (supertitle comes first)
                    text: attribs.supertitle
                        ? `${attribs.supertitle}\v${getSpanContent(element)}`
                        : getSpanContent(element),
                    level: attribs.level,
                },
            })
        )
        .with("horizontal-rule", () => ({
            type: "horizontal-rule" as const,
            value: {},
        }))
        .with(
            "chart",
            (): RawBlockChart => ({
                type: "chart",
                value: {
                    url: attribs.url,
                    height: attribs.height,
                    size: attribs.size as BlockSize | undefined,
                    visibility: attribs.visibility,
                    caption: getChildElement(element, "caption")
                        ? getSpanContent(getChildElement(element, "caption")!)
                        : undefined,
                },
            })
        )
        .with(
            "narrative-chart",
            (): RawBlockNarrativeChart => ({
                type: "narrative-chart",
                value: {
                    name: attribs.name,
                    height: attribs.height,
                    size: attribs.size as BlockSize | undefined,
                    caption: getChildElement(element, "caption")
                        ? getSpanContent(getChildElement(element, "caption")!)
                        : undefined,
                },
            })
        )
        .with(
            "image",
            (): RawBlockImage => ({
                type: "image",
                value: {
                    filename: attribs.filename,
                    smallFilename: attribs.smallFilename,
                    alt: attribs.alt,
                    size: attribs.size as BlockSize | undefined,
                    hasOutline: attribs.hasOutline,
                    visibility: attribs.visibility,
                    caption: getChildElement(element, "caption")
                        ? getSpanContent(getChildElement(element, "caption")!)
                        : undefined,
                },
            })
        )
        .with(
            "video",
            (): RawBlockVideo => ({
                type: "video",
                value: {
                    url: attribs.url,
                    filename: attribs.filename,
                    shouldLoop: attribs.shouldLoop,
                    shouldAutoplay: attribs.shouldAutoplay,
                    visibility: attribs.visibility,
                    caption: getChildElement(element, "caption")
                        ? getSpanContent(getChildElement(element, "caption")!)
                        : undefined,
                },
            })
        )
        .with(
            "static-viz",
            (): RawBlockStaticViz => ({
                type: "static-viz",
                value: {
                    name: attribs.name,
                    size: attribs.size as BlockSize | undefined,
                    hasOutline: attribs.hasOutline,
                },
            })
        )
        .with(
            "list",
            (): RawBlockList => ({
                type: "list",
                value: getChildElements(element, "li").map((li) =>
                    getSpanContent(li)
                ),
            })
        )
        .with(
            "numbered-list",
            (): RawBlockNumberedList => ({
                type: "numbered-list",
                value: getChildElements(element, "li").map((li) =>
                    getSpanContent(li)
                ),
            })
        )
        .with(
            "aside",
            (): RawBlockAside => ({
                type: "aside",
                value: {
                    position: attribs.position,
                    caption: getSpanContent(element),
                },
            })
        )
        .with(
            "callout",
            (): RawBlockCallout => ({
                type: "callout",
                value: {
                    icon: attribs.icon as "info" | undefined,
                    title: attribs.title,
                    text: getAllChildElements(element).map(
                        elementToRawBlock
                    ) as (RawBlockText | RawBlockHeading | RawBlockList)[],
                },
            })
        )
        .with(
            "blockquote",
            (): RawBlockBlockquote => ({
                type: "blockquote",
                value: {
                    citation: attribs.citation,
                    text: getAllChildElements(element).map(
                        elementToRawBlock
                    ) as RawBlockText[],
                },
            })
        )
        .with(
            "pull-quote",
            (): RawBlockPullQuote => ({
                type: "pull-quote",
                value: {
                    align: attribs.align as "left" | "right" | undefined,
                    quote: attribs.quote,
                    content: getAllChildElements(element).map(
                        elementToRawBlock
                    ) as OwidRawGdocBlock[],
                },
            })
        )
        .with(
            "code",
            (): RawBlockCode => ({
                type: "code",
                value: getChildElements(element, "line").map((line) => ({
                    type: "text" as const,
                    value: getDirectTextContent(line),
                })),
            })
        )
        .with(
            "html",
            (): RawBlockHtml => ({
                type: "html",
                // The HTML content is stored in the value attribute
                value: attribs.value ?? "",
            })
        )
        .with(
            "script",
            (): RawBlockScript => ({
                type: "script",
                value: getChildElements(element, "line").map((line) => ({
                    type: "text" as const,
                    value: getDirectTextContent(line),
                })),
            })
        )
        .with(
            "table",
            (): RawBlockTable => ({
                type: "table",
                value: {
                    template: attribs.template as
                        | "header-column"
                        | "header-row"
                        | "header-column-row"
                        | undefined,
                    size: attribs.size as "narrow" | "wide" | undefined,
                    caption: getChildElement(element, "caption")
                        ? getSpanContent(getChildElement(element, "caption")!)
                        : undefined,
                    rows: getChildElements(element, "row").map((row) => ({
                        type: "table-row" as const,
                        value: {
                            cells: getChildElements(row, "cell").map(
                                (cell) => ({
                                    type: "table-cell" as const,
                                    value: getAllChildElements(cell).map(
                                        elementToRawBlock
                                    ),
                                })
                            ),
                        },
                    })),
                },
            })
        )
        .with(
            "side-by-side",
            (): RawBlockSideBySideContainer => ({
                type: "side-by-side",
                value: {
                    left: getAllChildElements(
                        getChildElement(element, "left") ?? element
                    ).map(elementToRawBlock),
                    right: getAllChildElements(
                        getChildElement(element, "right") ?? element
                    ).map(elementToRawBlock),
                },
            })
        )
        .with(
            "sticky-left",
            (): RawBlockStickyLeftContainer => ({
                type: "sticky-left",
                value: {
                    left: getAllChildElements(
                        getChildElement(element, "left") ?? element
                    ).map(elementToRawBlock),
                    right: getAllChildElements(
                        getChildElement(element, "right") ?? element
                    ).map(elementToRawBlock),
                },
            })
        )
        .with(
            "sticky-right",
            (): RawBlockStickyRightContainer => ({
                type: "sticky-right",
                value: {
                    left: getAllChildElements(
                        getChildElement(element, "left") ?? element
                    ).map(elementToRawBlock),
                    right: getAllChildElements(
                        getChildElement(element, "right") ?? element
                    ).map(elementToRawBlock),
                },
            })
        )
        .with(
            "gray-section",
            (): RawBlockGraySection => ({
                type: "gray-section",
                value: getAllChildElements(element).map(elementToRawBlock),
            })
        )
        .with(
            "explore-data-section",
            (): RawBlockExploreDataSection => ({
                type: "explore-data-section",
                value: {
                    title: attribs.title,
                    align: attribs.align as "left" | "right" | undefined,
                    content:
                        getAllChildElements(element).map(elementToRawBlock),
                },
            })
        )
        .with(
            "align",
            (): RawBlockAlign => ({
                type: "align",
                value: {
                    alignment: attribs.alignment,
                    content:
                        getAllChildElements(element).map(elementToRawBlock),
                },
            })
        )
        .with(
            "expandable-paragraph",
            (): RawBlockExpandableParagraph => ({
                type: "expandable-paragraph",
                value: getAllChildElements(element).map(elementToRawBlock),
            })
        )
        .with(
            "expander",
            (): RawBlockExpander => ({
                type: "expander",
                value: {
                    title: attribs.title,
                    heading: attribs.heading,
                    subtitle: attribs.subtitle,
                    content:
                        getAllChildElements(element).map(elementToRawBlock),
                },
            })
        )
        .with(
            "guided-chart",
            (): RawBlockGuidedChart => ({
                type: "guided-chart",
                value: getAllChildElements(element).map(elementToRawBlock),
            })
        )
        .with(
            "prominent-link",
            (): RawBlockProminentLink => ({
                type: "prominent-link",
                value: {
                    url: attribs.url,
                    title: attribs.title,
                    description: attribs.description,
                    thumbnail: attribs.thumbnail,
                },
            })
        )
        .with(
            "recirc",
            (): RawBlockRecirc => ({
                type: "recirc",
                value: {
                    title: attribs.title,
                    align: attribs.align,
                    links: getChildElements(element, "link").map((link) => ({
                        url: link.attribs.url,
                        title: link.attribs.title,
                        subtitle: link.attribs.subtitle,
                    })),
                },
            })
        )
        .with(
            "key-insights",
            (): RawBlockKeyInsights => ({
                type: "key-insights",
                value: {
                    heading: attribs.heading,
                    insights: getChildElements(element, "slide").map(
                        (slide) => ({
                            title: slide.attribs.title,
                            url: slide.attribs.url,
                            filename: slide.attribs.filename,
                            narrativeChartName:
                                slide.attribs.narrativeChartName,
                            content:
                                getAllChildElements(slide).map(
                                    elementToRawBlock
                                ),
                        })
                    ),
                },
            })
        )
        .with(
            "key-indicator",
            (): RawBlockKeyIndicator => ({
                type: "key-indicator",
                value: {
                    datapageUrl: attribs.datapageUrl,
                    title: attribs.title,
                    source: attribs.source,
                    text: getAllChildElements(element).map(
                        elementToRawBlock
                    ) as RawBlockText[],
                },
            })
        )
        .with(
            "key-indicator-collection",
            (): RawBlockKeyIndicatorCollection => ({
                type: "key-indicator-collection",
                value: {
                    indicators:
                        getAllChildElements(element).map(elementToRawBlock),
                },
            })
        )
        .with(
            "additional-charts",
            (): RawBlockAdditionalCharts => ({
                type: "additional-charts",
                value: {
                    list: getChildElements(element, "item").map((item) =>
                        getSpanContent(item)
                    ),
                },
            })
        )
        .with(
            "all-charts",
            (): RawBlockAllCharts => ({
                type: "all-charts",
                value: {
                    heading: attribs.heading,
                    top: getChildElements(element, "top").map((top) => ({
                        url: top.attribs.url,
                    })),
                },
            })
        )
        .with(
            "donors",
            (): RawBlockDonorList => ({
                type: "donors",
                value: {},
            })
        )
        .with(
            "sdg-grid",
            (): RawBlockSDGGrid => ({
                type: "sdg-grid",
                value: getChildElements(element, "item").map((item) => ({
                    goal: item.attribs.goal,
                    link: item.attribs.link,
                })),
            })
        )
        .with(
            "sdg-toc",
            (): RawBlockSDGToc => ({
                type: "sdg-toc",
                value: {},
            })
        )
        .with(
            "ltp-toc",
            (): RawBlockLTPToc => ({
                type: "ltp-toc",
                value: attribs.title ? { title: attribs.title } : {},
            })
        )
        .with(
            "missing-data",
            (): RawBlockMissingData => ({
                type: "missing-data",
                value: {},
            })
        )
        .with("chart-story", (): RawBlockChartStory => {
            const items = getChildElements(element, "item").map((item) => {
                const narrative = getChildElement(item, "narrative")
                const chart = getChildElement(item, "chart")
                const technical = getChildElement(item, "technical")
                return {
                    narrative: narrative ? getSpanContent(narrative) : "",
                    chart: chart ? chart.attribs.url : "",
                    technical: technical
                        ? {
                              list: getChildElements(technical, "text").map(
                                  (t) => getSpanContent(t)
                              ),
                          }
                        : undefined,
                }
            })
            return {
                type: "chart-story",
                value: items,
            }
        })
        .with(
            "topic-page-intro",
            (): RawBlockTopicPageIntro => ({
                type: "topic-page-intro",
                value: {
                    "download-button": getChildElement(
                        element,
                        "download-button"
                    )
                        ? {
                              text: getChildElement(element, "download-button")!
                                  .attribs.text,
                              url: getChildElement(element, "download-button")!
                                  .attribs.url,
                          }
                        : undefined,
                    "related-topics": getChildElement(element, "related-topics")
                        ? getChildElements(
                              getChildElement(element, "related-topics")!,
                              "topic"
                          ).map((topic) => ({
                              url: topic.attribs.url,
                              text: topic.attribs.text,
                          }))
                        : undefined,
                    content: getAllChildElements(
                        getChildElement(element, "content") ?? element
                    ).map(elementToRawBlock) as RawBlockText[],
                },
            })
        )
        .with(
            "research-and-writing",
            (): RawBlockResearchAndWriting => ({
                type: "research-and-writing",
                value: {
                    heading: attribs.heading,
                    // Only include hide-authors/hide-date if they exist in the XHTML
                    // to avoid validation errors for undefined values
                    ...(attribs["hide-authors"] !== undefined && {
                        "hide-authors": attribs["hide-authors"],
                    }),
                    ...(attribs["hide-date"] !== undefined && {
                        "hide-date": attribs["hide-date"],
                    }),
                    variant: attribs.variant as
                        | ResearchAndWritingVariant
                        | undefined,
                    primary: getChildElement(element, "primary")
                        ? getChildElements(
                              getChildElement(element, "primary")!,
                              "link"
                          ).map((link) => ({
                              url: link.attribs.url,
                              title: link.attribs.title,
                              subtitle: link.attribs.subtitle,
                              authors: link.attribs.authors,
                              filename: link.attribs.filename,
                          }))
                        : undefined,
                    secondary: getChildElement(element, "secondary")
                        ? getChildElements(
                              getChildElement(element, "secondary")!,
                              "link"
                          ).map((link) => ({
                              url: link.attribs.url,
                              title: link.attribs.title,
                              subtitle: link.attribs.subtitle,
                              authors: link.attribs.authors,
                              filename: link.attribs.filename,
                          }))
                        : undefined,
                    rows: getChildElements(element, "row").map((row) => ({
                        heading: row.attribs.heading,
                        articles: getChildElements(row, "link").map((link) => ({
                            url: link.attribs.url,
                            title: link.attribs.title,
                            subtitle: link.attribs.subtitle,
                            authors: link.attribs.authors,
                            filename: link.attribs.filename,
                        })),
                    })),
                    more: getChildElement(element, "more")
                        ? {
                              heading: getChildElement(element, "more")!.attribs
                                  .heading,
                              articles: getChildElements(
                                  getChildElement(element, "more")!,
                                  "link"
                              ).map((link) => ({
                                  url: link.attribs.url,
                                  title: link.attribs.title,
                                  subtitle: link.attribs.subtitle,
                                  authors: link.attribs.authors,
                                  filename: link.attribs.filename,
                              })),
                          }
                        : undefined,
                    latest: getChildElement(element, "latest")
                        ? {
                              heading: getChildElement(element, "latest")!
                                  .attribs.heading,
                          }
                        : undefined,
                },
            })
        )
        .with(
            "entry-summary",
            (): RawBlockEntrySummary => ({
                type: "entry-summary",
                value: {
                    items: getChildElements(element, "item").map((item) => ({
                        text: item.attribs.text,
                        slug: item.attribs.slug,
                    })),
                },
            })
        )
        .with(
            "explorer-tiles",
            (): RawBlockExplorerTiles => ({
                type: "explorer-tiles",
                value: {
                    title: attribs.title,
                    subtitle: attribs.subtitle,
                    explorers: getChildElements(element, "explorer").map(
                        (e) => ({
                            url: e.attribs.url,
                        })
                    ),
                },
            })
        )
        .with(
            "pill-row",
            (): RawBlockPillRow => ({
                type: "pill-row",
                value: {
                    title: attribs.title,
                    pills: getChildElements(element, "pill").map((pill) => ({
                        url: pill.attribs.url,
                        text: pill.attribs.text,
                    })),
                },
            })
        )
        .with(
            "homepage-search",
            (): RawBlockHomepageSearch => ({
                type: "homepage-search",
                value: {},
            })
        )
        .with(
            "homepage-intro",
            (): RawBlockHomepageIntro => ({
                type: "homepage-intro",
                value: {
                    "featured-work": getChildElements(
                        element,
                        "featured-work"
                    ).map((post) => ({
                        url: post.attribs.url,
                        title: post.attribs.title,
                        description: post.attribs.description,
                        filename: post.attribs.filename,
                        kicker: post.attribs.kicker,
                        authors: post.attribs.authors,
                        isNew: post.attribs.isNew,
                    })),
                },
            })
        )
        .with(
            "featured-metrics",
            (): RawBlockFeaturedMetrics => ({
                type: "featured-metrics",
                value: {},
            })
        )
        .with(
            "featured-data-insights",
            (): RawBlockFeaturedDataInsights => ({
                type: "featured-data-insights",
                value: {},
            })
        )
        .with(
            "latest-data-insights",
            (): RawBlockLatestDataInsights => ({
                type: "latest-data-insights",
                value: {},
            })
        )
        .with(
            "cookie-notice",
            (): RawBlockCookieNotice => ({
                type: "cookie-notice",
                value: {},
            })
        )
        .with(
            "subscribe-banner",
            (): RawBlockSubscribeBanner => ({
                type: "subscribe-banner",
                value: attribs.align ? { align: attribs.align } : {},
            })
        )
        .with(
            "cta",
            (): RawBlockCta => ({
                type: "cta",
                value: {
                    text: attribs.text,
                    url: attribs.url,
                },
            })
        )
        .with(
            "socials",
            (): RawBlockSocials => ({
                type: "socials",
                value: getChildElements(element, "link").map((link) => ({
                    url: link.attribs.url,
                    text: link.attribs.text,
                    type: link.attribs.type,
                })) as RawSocialLink[],
            })
        )
        .with(
            "people",
            (): RawBlockPeople => ({
                type: "people",
                value: getChildElements(element, "person").map(
                    elementToRawPerson
                ),
            })
        )
        .with(
            "people-rows",
            (): RawBlockPeopleRows => ({
                type: "people-rows",
                value: {
                    columns: attribs.columns as "2" | "4",
                    people: getChildElements(element, "person").map(
                        elementToRawPerson
                    ),
                },
            })
        )
        .with("person", (): RawBlockPerson => elementToRawPerson(element))
        .with(
            "resource-panel",
            (): RawBlockResourcePanel => ({
                type: "resource-panel",
                value: {
                    icon: attribs.icon as "link" | "download" | undefined,
                    kicker: attribs.kicker,
                    title: attribs.title,
                    buttonText: attribs.buttonText,
                    links: getChildElements(element, "link").map((link) => ({
                        url: link.attribs.url,
                        title: link.attribs.title,
                        subtitle: link.attribs.subtitle,
                    })),
                },
            })
        )
        .otherwise(() => {
            throw new XhtmlParseError(`Unknown block type: <${tag}>`)
        })
}

/**
 * Parse XHTML string to raw blocks.
 * Throws XhtmlParseError for unknown block types.
 */
export function xhtmlToRawBlocks(xhtml: string): OwidRawGdocBlock[] {
    const $ = cheerio.load(xhtml, { xml: true })

    // Find the root content - either inside <gdoc> or at root level
    const gdoc = $("gdoc")
    const elements = (
        gdoc.length > 0 ? gdoc.children() : $.root().children()
    ).toArray() as Element[]
    return elements.filter((el) => el.type === "tag").map(elementToRawBlock)
}

/**
 * Parse XHTML string to enriched blocks.
 * Runs through the standard raw → enriched conversion for validation.
 * Throws XhtmlParseError for unknown block types.
 */
export function xhtmlToEnrichedBlocks(xhtml: string): OwidEnrichedGdocBlock[] {
    const rawBlocks = xhtmlToRawBlocks(xhtml)
    return excludeNullish(rawBlocks.map(parseRawBlocksToEnrichedBlocks))
}
