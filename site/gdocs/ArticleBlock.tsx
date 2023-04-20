import React from "react"
import cx from "classnames"

import ChartStory from "./ChartStory.js"
import Scroller from "./Scroller.js"
import Chart from "./Chart.js"
import PullQuote from "./PullQuote.js"
import Recirc from "./Recirc.js"
import List from "./List.js"
import NumberedList from "./NumberedList.js"
import Image from "./Image.js"
import {
    get,
    OwidEnrichedGdocBlock,
    spansToUnformattedPlainText,
    TocHeadingWithTitleSupertitle,
    Url,
    convertHeadingTextToId,
} from "@ourworldindata/utils"
import SDGGrid from "./SDGGrid.js"
import { BlockErrorBoundary, BlockErrorFallback } from "./BlockErrorBoundary.js"
import { match } from "ts-pattern"
import { renderSpans } from "./utils.js"
import Paragraph from "./Paragraph.js"
import SDGTableOfContents from "./SDGTableOfContents.js"
import urlSlug from "url-slug"
import { MissingData } from "./MissingData.js"
import { AdditionalCharts } from "./AdditionalCharts.js"
import { ProminentLink } from "./ProminentLink.js"
import { TopicPageIntro } from "./TopicPageIntro.js"

export type Container =
    | "default"
    | "sticky-right-left-column"
    | "sticky-right-right-column"
    | "sticky-left-left-column"
    | "sticky-left-right-column"
    | "side-by-side"
    | "summary"
    | "datapage"

// Each container must have a default layout, usually just full-width
type Layouts = { default: string; [key: string]: string }

// no line-wrapping for easier alphabetisation
// prettier-ignore
const layouts: { [key in Container]: Layouts} = {
    ["default"]: {
        ["aside-left"]: "col-start-2 span-cols-3 span-md-cols-10 col-md-start-3",
        ["aside-right"]: "col-start-11 span-cols-3 span-md-cols-10 col-md-start-3",
        ["chart-story"]: "col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["chart"]: "col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["explorer"]: "col-start-3 span-cols-10 span-md-cols-12 col-md-start-2",
        ["default"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["divider"]: "col-start-2 span-cols-12",
        ["gray-section"]: "span-cols-14 grid grid-cols-12-full-width",
        ["heading"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["horizontal-rule"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["html"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["image--narrow"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12 ",
        ["image--wide"]: "col-start-4 span-cols-8 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12 ",
        ["image-caption"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["list"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["numbered-list"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 grid-md-cols-10 span-sm-cols-12 col-sm-start-2 grid-sm-cols-12",
        ["pull-quote"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["recirc"]: "col-start-11 span-cols-3 span-rows-3 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["scroller"]: "grid span-cols-12 col-start-2",
        ["sdg-grid"]: "grid col-start-2 span-cols-12 col-lg-start-3 span-lg-cols-10 span-sm-cols-12 col-sm-start-2",
        ["sdg-toc"]: "grid grid-cols-8 col-start-4 span-cols-8 grid-md-cols-10 col-md-start-3 span-md-cols-10 grid-sm-cols-12 span-sm-cols-12 col-sm-start-2",
        ["side-by-side"]: "grid span-cols-12 col-start-2",
        ["sticky-left-left-column"]: "grid grid-cols-7 span-cols-7 span-md-cols-12 grid-md-cols-12",
        ["sticky-left-right-column"]: "grid grid-cols-5 span-cols-5 span-md-cols-12 grid-md-cols-12",
        ["sticky-left"]: "grid span-cols-12 col-start-2",
        ["sticky-right-left-column"]: "grid span-cols-5 grid grid-cols-5 span-md-cols-12 grid-md-cols-12",
        ["sticky-right-right-column"]: "span-cols-7 span-md-cols-12",
        ["sticky-right"]: "grid span-cols-12 col-start-2",
        ["text"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["topic-page-intro"]: "grid col-start-2 span-cols-12",
    },
    ["datapage"]: {
        ["default"]: "col-start-2 span-cols-6",
        ["chart"]: "col-start-1 span-cols-8",
    },
    ["sticky-right-left-column"]: {
        ["chart"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-5 col-start-1 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 grid-md-cols-10 span-sm-cols-12 col-sm-start-2 grid-sm-cols-12",
    },
    ["sticky-right-right-column"]: {
        ["chart"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-7 span-md-cols-10 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 span-sm-cols-12 col-sm-start-2 grid-sm-cols-12",
    },
    ["sticky-left-left-column"]: {
        ["chart"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-7 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 span-sm-cols-12 col-sm-start-1 grid-sm-cols-12",
    },
    ["sticky-left-right-column"]: {
        ["chart"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-5 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 grid-md-cols-10 span-sm-cols-12 col-sm-start-2 grid-sm-cols-12",
    },
    ["side-by-side"]: {
        ["default"]: "span-cols-6 span-sm-cols-12",
    },
    ["summary"]: {
        ["default"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
    },
}

export function getLayout(
    blockType: string = "default",
    containerType: Container = "default"
): string {
    const layout = get(
        layouts,
        [containerType, blockType],
        // fallback to the default for the container
        get(layouts, [containerType, "default"])
    )
    return cx(`article-block__${blockType}`, layout)
}

export default function ArticleBlock({
    b: block,
    containerType = "default",
    toc,
}: {
    b: OwidEnrichedGdocBlock
    containerType?: Container
    toc?: TocHeadingWithTitleSupertitle[]
}) {
    block.type = block.type.toLowerCase() as any // this comes from the user and may not be all lowercase, enforce it here
    if (block.parseErrors.length > 0) {
        return (
            <BlockErrorFallback
                className={getLayout("default", containerType)}
                error={{
                    name: `Error in ${block.type}`,
                    message: block.parseErrors[0].message,
                }}
            />
        )
    }
    const content: any | null = match(block)
        .with({ type: "aside" }, ({ caption, position = "right" }) => (
            <figure
                className={cx(
                    "body-3-medium-italic",
                    getLayout(`aside-${position}`)
                )}
            >
                {caption ? (
                    <figcaption>{renderSpans(caption)}</figcaption>
                ) : null}
            </figure>
        ))
        .with({ type: "chart" }, (block) => {
            const { isExplorer } = Url.fromURL(block.url)
            const layoutSubtype = isExplorer ? "explorer" : "chart"
            return (
                <Chart
                    className={getLayout(layoutSubtype, containerType)}
                    d={block}
                />
            )
        })
        .with({ type: "scroller" }, (block) => (
            <Scroller
                className={getLayout("scroller", containerType)}
                d={block}
            />
        ))
        .with({ type: "callout" }, (block) => (
            <div className={getLayout("callout", containerType)}>
                {block.title ? (
                    <h4 className="h4-semibold">{block.title}</h4>
                ) : null}
                {block.text.map((text, i) => (
                    <p className="body-3-medium" key={i}>
                        {renderSpans(text)}
                    </p>
                ))}
            </div>
        ))
        .with({ type: "chart-story" }, (block) => (
            <ChartStory
                d={block}
                className={getLayout("chart-story", containerType)}
            />
        ))
        .with({ type: "image" }, (block) => (
            <figure
                className={cx(
                    "article-block__image",
                    getLayout(`image--${block.size}`, containerType)
                )}
            >
                <Image
                    filename={block.filename}
                    alt={block.alt}
                    containerType={containerType}
                />
                {block.caption ? (
                    <figcaption
                        className={getLayout("image-caption", containerType)}
                    >
                        {renderSpans(block.caption)}
                    </figcaption>
                ) : null}
            </figure>
        ))
        .with({ type: "pull-quote" }, (block) => (
            <PullQuote
                className={getLayout("pull-quote", containerType)}
                d={block}
            />
        ))
        .with({ type: "recirc" }, (block) => (
            <Recirc className={getLayout("recirc", containerType)} d={block} />
        ))
        .with({ type: "numbered-list" }, (block) => (
            <NumberedList
                className={getLayout("numbered-list", containerType)}
                d={block}
            />
        ))
        .with({ type: "list" }, (block) => (
            <List className={getLayout("list", containerType)} d={block} />
        ))
        .with({ type: "text" }, (block) => {
            return (
                <Paragraph
                    d={block}
                    className={getLayout("text", containerType)}
                />
            )
        })
        .with({ type: "simple-text" }, (block) => {
            return block.value
        })
        .with({ type: "heading", level: 1 }, (block) => (
            <h1
                className={cx(
                    "h1-semibold",
                    getLayout("heading", containerType)
                )}
                id={convertHeadingTextToId(block.text)}
            >
                {renderSpans(block.text)}
            </h1>
        ))
        .with({ type: "heading", level: 2 }, (block) => {
            const { supertitle, text } = block

            const id = supertitle
                ? urlSlug(
                      `${spansToUnformattedPlainText(
                          supertitle
                      )}-${spansToUnformattedPlainText(text)}`
                  )
                : convertHeadingTextToId(block.text)

            return (
                <>
                    {supertitle ? (
                        <div className={getLayout("divider", containerType)} />
                    ) : null}
                    <h2
                        className={cx(
                            "h2-bold",
                            getLayout("heading", containerType),
                            {
                                "has-supertitle": supertitle
                                    ? spansToUnformattedPlainText(supertitle)
                                    : "",
                            }
                        )}
                        id={id}
                    >
                        {supertitle ? (
                            <div className="article-block__heading-supertitle overline-black-caps">
                                {renderSpans(supertitle)}
                            </div>
                        ) : null}
                        {renderSpans(text)}
                    </h2>
                </>
            )
        })
        .with({ type: "heading", level: 3 }, (block) => {
            const { supertitle, text } = block
            const id = supertitle
                ? urlSlug(
                      `${spansToUnformattedPlainText(
                          supertitle
                      )}-${spansToUnformattedPlainText(text)}`
                  )
                : convertHeadingTextToId(block.text)
            return (
                <h3
                    className={cx(
                        "h3-bold",
                        getLayout("heading", containerType),
                        {
                            "has-supertitle": supertitle
                                ? spansToUnformattedPlainText(supertitle)
                                : undefined,
                        }
                    )}
                    id={id}
                >
                    {supertitle ? (
                        <div className="article-block__heading-supertitle overline-black-caps">
                            {renderSpans(supertitle)}
                        </div>
                    ) : null}
                    {renderSpans(text)}
                </h3>
            )
        })
        .with({ type: "heading", level: 4 }, (block) => (
            <h4
                className={cx(
                    "h4-semibold",
                    getLayout("heading", containerType)
                )}
                id={convertHeadingTextToId(block.text)}
            >
                {renderSpans(block.text)}
            </h4>
        ))
        .with({ type: "heading", level: 5 }, (block) => (
            <h5
                className={cx(
                    "overline-black-caps",
                    getLayout("heading", containerType)
                )}
                id={convertHeadingTextToId(block.text)}
            >
                {renderSpans(block.text)}
            </h5>
        ))
        .with(
            { type: "heading" },
            // during parsing we take care of level being in a valid range
            () => null
        )
        .with({ type: "html" }, (block) => (
            <div
                className={getLayout("html", containerType)}
                dangerouslySetInnerHTML={{ __html: block.value }}
            />
        ))
        .with({ type: "horizontal-rule" }, () => (
            <hr className={getLayout("horizontal-rule", containerType)} />
        ))
        .with({ type: "sdg-grid" }, (block) => (
            <SDGGrid
                className={getLayout("sdg-grid", containerType)}
                d={block}
            />
        ))
        .with({ type: "sticky-right" }, (block) => (
            <div className={getLayout("sticky-right", containerType)}>
                <div
                    className={getLayout(
                        "sticky-right-left-column",
                        containerType
                    )}
                >
                    {block.left.map((item, i) => (
                        <ArticleBlock
                            key={i}
                            b={item}
                            containerType="sticky-right-left-column"
                        />
                    ))}
                </div>
                <div
                    className={getLayout(
                        "sticky-right-right-column",
                        containerType
                    )}
                >
                    <div className="sticky-column-wrapper grid grid-cols-7 span-cols-7 grid-md-cols-12 span-md-cols-12">
                        {block.right.map((item, i) => (
                            <ArticleBlock
                                key={i}
                                b={item}
                                containerType="sticky-right-right-column"
                            />
                        ))}
                    </div>
                </div>
            </div>
        ))
        .with({ type: "sticky-left" }, (block) => (
            <div className={getLayout("sticky-left", containerType)}>
                <div
                    className={getLayout(
                        "sticky-left-left-column",
                        containerType
                    )}
                >
                    <div className="sticky-column-wrapper grid grid-cols-7 span-cols-7 grid-md-cols-12 span-md-cols-12">
                        {block.left.map((item, i) => (
                            <ArticleBlock
                                key={i}
                                b={item}
                                containerType="sticky-left-left-column"
                            />
                        ))}
                    </div>
                </div>
                <div
                    className={getLayout(
                        "sticky-left-right-column",
                        containerType
                    )}
                >
                    {block.right.map((item, i) => (
                        <ArticleBlock
                            key={i}
                            b={item}
                            containerType="sticky-left-right-column"
                        />
                    ))}
                </div>
            </div>
        ))
        .with({ type: "side-by-side" }, (block) => (
            <div className={getLayout("side-by-side", containerType)}>
                <div className="grid grid-cols-6 span-cols-6 span-sm-cols-12">
                    {block.left.map((item, i) => (
                        <ArticleBlock
                            key={i}
                            b={item}
                            containerType="side-by-side"
                        />
                    ))}
                </div>
                <div className="grid grid-cols-6 span-cols-6 span-sm-cols-12">
                    {block.right.map((item, i) => (
                        <ArticleBlock
                            key={i}
                            b={item}
                            containerType="side-by-side"
                        />
                    ))}
                </div>
            </div>
        ))
        .with({ type: "gray-section" }, (block) => (
            <div className={getLayout("gray-section")}>
                {block.items.map((item, i) => (
                    <ArticleBlock key={i} b={item} />
                ))}
            </div>
        ))
        .with({ type: "prominent-link" }, (block) => (
            <ProminentLink
                className={getLayout("prominent-link", containerType)}
                {...block}
            />
        ))
        .with({ type: "sdg-toc" }, () => {
            return toc ? (
                <SDGTableOfContents
                    toc={toc}
                    className={getLayout("sdg-toc", containerType)}
                />
            ) : null
        })
        .with({ type: "missing-data" }, () => (
            <MissingData className={getLayout("missing-data", containerType)} />
        ))
        .with({ type: "additional-charts" }, (block) => (
            <AdditionalCharts // bla
                items={block.items}
                className={getLayout("additional-charts", containerType)}
            />
        ))
        .with({ type: "topic-page-intro" }, (block) => (
            <TopicPageIntro
                {...block}
                className={getLayout("topic-page-intro", containerType)}
            />
        ))
        .exhaustive()

    // if (_type === "chart-grid") {
    //     let columns = 1
    //     try {
    //         columns =
    //             +b.value.find(
    //                 (_d: OwidRawGdocBlock) => _d.type === "columns"
    //             ).value || 1
    //     } catch (e) {}

    //     return (
    //         <div
    //             key={key}
    //             className={"chartGrid"}
    //             style={{
    //                 display: "grid",
    //                 gridTemplateRows: "auto",
    //                 gridTemplateColumns: `repeat(${columns}, 1fr)`,
    //             }}
    //         >
    //             {d.value
    //                 .filter((_d: OwidRawGdocBlock) => _d.type === "chart")
    //                 .map((_d: OwidRawGdocBlock, i: number) => {
    //                     return <Chart d={_d} key={i} />
    //                 })}
    //         </div>
    //     )

    return (
        <BlockErrorBoundary className={getLayout("default", containerType)}>
            {content}
        </BlockErrorBoundary>
    )
}
