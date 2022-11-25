import React from "react"
import cx from "classnames"

import ChartStory from "./ChartStory"
import Scroller from "./Scroller"
import Chart from "./Chart"
import PullQuote from "./PullQuote"
import FixedGraphic from "./FixedGraphic"
import Recirc from "./Recirc"
import List from "./List"
import Image from "./Image"
import { get, OwidEnrichedArticleBlock } from "@ourworldindata/utils"
import SDGGrid from "./SDGGrid.js"
import { BlockErrorBoundary, BlockErrorFallback } from "./BlockErrorBoundary"
import { match } from "ts-pattern"
import { renderSpans } from "./utils"
import Paragraph from "./Paragraph.js"

type LayoutDictionary = {
    // TODO: find a better way to type this to prevent typos but also support "aside-right" and "aside-left"
    // default: Record<OwidEnrichedArticleBlock["type"], string>
    // TODO: other containerType types e.g. sticky-right
}

const layouts: LayoutDictionary = {
    default: {
        "chart-story": "col-start-4 span-cols-8",
        "fixed-graphic":
            "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        "horizontal-rule":
            "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        "grey-section": "span-cols-14 grid grid-cols-12-full-width",
        "pull-quote":
            "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        "sdg-grid":
            "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        "aside-right": "col-start-11 span-cols-3",
        "aside-left": "col-start-2 span-cols-3",
        "sticky-left": "col-start-2 span-cols-12 grid",
        "sticky-left-left-column":
            "span-cols-7 span-md-cols-12 grid-md-cols-12",
        "sticky-left-right-column":
            "span-cols-5 span-md-cols-12 col-md-start-1",
        "sticky-right": "col-start-2 span-cols-12 grid",
        "sticky-right-left-column":
            "span-cols-5 grid grid-cols-5 span-md-cols-12 grid-md-cols-12",
        "sticky-right-right-column":
            "span-cols-7 span-md-cols-12 col-md-start-1",
        chart: "col-start-4 span-cols-8",
        default:
            "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        header: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        html: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        image: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        list: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        recirc: "col-start-11 span-cols-3 span-rows-3 col-md-start-5 span-md-cols-6",
        scroller:
            "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        text: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
    },
    "sticky-right-left-column": {
        default: "span-cols-5 col-start-1 span-md-cols-12",
    },
    "sticky-right-right-column": {
        default: "span-cols-7 col-start-1 span-md-cols-12",
    },
}

type Container =
    | "default"
    | "sticky-right-left-column"
    | "sticky-right-right-column"
    | "sticky-left-left-column"
    | "sticky-left-right-column"

function getLayout(
    // Default layout is "col-start-5 span-cols-6" aka centered 6-wide column
    blockType: string = "default",
    containerType: Container = "default"
): string {
    const layout = get(
        layouts,
        [containerType, blockType],
        get(layouts, [containerType, "default"], "span-cols-12")
    )
    return cx(`article-block__${blockType}`, layout)
}

export default function ArticleBlock({
    b,
    containerType = "default",
}: {
    b: OwidEnrichedArticleBlock
    containerType?: Container
}) {
    const handleArchie = (block: OwidEnrichedArticleBlock, key: string) => {
        block.type = block.type.toLowerCase() as any // this comes from the user and may not be all lowercase, enforce it here
        if (block.parseErrors.length > 0) {
            return (
                <BlockErrorFallback
                    className={getLayout("default", containerType)}
                    error={{
                        name: `error in ${block.type}`,
                        message: block.parseErrors[0].message,
                    }}
                    resetErrorBoundary={() => {
                        return
                    }}
                />
            )
        } else {
            const content: any | null = match(block)
                .with({ type: "aside" }, ({ caption, position = "right" }) => (
                    <figure
                        key={key}
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
                .with({ type: "chart" }, (block) => (
                    <Chart
                        className={getLayout("chart", containerType)}
                        d={block}
                        key={key}
                    />
                ))
                .with(
                    { type: "scroller" },
                    (block) =>
                        null && (
                            <Scroller
                                className={getLayout("scroller", containerType)}
                                d={block}
                                key={key}
                            />
                        )
                )
                .with({ type: "chart-story" }, (block) => (
                    <ChartStory
                        key={key}
                        d={block}
                        className={getLayout("chart-story", containerType)}
                    />
                ))
                .with({ type: "fixed-graphic" }, (block) => (
                    <FixedGraphic
                        className={getLayout("fixed-graphic", containerType)}
                        d={block}
                        key={key}
                    />
                ))
                .with({ type: "image" }, (block) => (
                    <Image
                        className={getLayout("image", containerType)}
                        d={block}
                        key={key}
                    />
                ))
                .with({ type: "pull-quote" }, (block) => (
                    <PullQuote
                        d={block}
                        key={key}
                        className={getLayout("pull-quote", containerType)}
                    />
                ))
                .with({ type: "recirc" }, (block) => (
                    <Recirc
                        d={block}
                        key={key}
                        className={getLayout("recirc", containerType)}
                    />
                ))
                .with({ type: "list" }, (block) => (
                    <List
                        className={getLayout("list", containerType)}
                        d={block}
                        key={key}
                    />
                ))
                .with({ type: "text" }, (block) => {
                    return (
                        <Paragraph
                            d={block}
                            key={key}
                            className={getLayout("text", containerType)}
                        />
                    )
                })
                .with({ type: "header", level: 1 }, (block) => (
                    <h1
                        className={cx(
                            "display-2-semibold",
                            getLayout("header", containerType)
                        )}
                    >
                        {block.text.text}
                    </h1>
                ))
                .with({ type: "header", level: 2 }, (block) => (
                    <h2
                        className={cx(
                            "h2-bold",
                            getLayout("header", containerType)
                        )}
                    >
                        {block.text.text}
                    </h2>
                ))
                .with({ type: "header", level: 3 }, (block) => (
                    <h3
                        className={cx(
                            "h3-bold",
                            getLayout("header", containerType)
                        )}
                    >
                        {block.text.text}
                    </h3>
                ))
                .with({ type: "header", level: 4 }, (block) => (
                    <h4
                        className={cx(
                            "h4-semibold",
                            getLayout("header", containerType)
                        )}
                    >
                        {block.text.text}
                    </h4>
                ))
                .with({ type: "header", level: 5 }, (block) => (
                    <h5
                        className={cx(
                            "overline-black-caps",
                            getLayout("header")
                        )}
                    >
                        {block.text.text}
                    </h5>
                ))
                .with({ type: "header", level: 6 }, (block) => (
                    <h6 className={getLayout("header", containerType)}>
                        {block.text.text}
                    </h6>
                ))
                .with(
                    { type: "header" },
                    // during parsing we take care of level being in a valid range
                    () => null
                )
                .with({ type: "html" }, (block) => (
                    <div
                        className={getLayout("html", containerType)}
                        dangerouslySetInnerHTML={{ __html: block.value }}
                    />
                ))
                .with({ type: "horizontal-rule" }, () => <hr></hr>)
                .with({ type: "sdg-grid" }, (block) => (
                    <SDGGrid
                        className={getLayout("sdg-grid", containerType)}
                        d={block}
                        key={key}
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
                            <div className="sticky-column-wrapper grid grid-cols-7 span-cols-7">
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
                            <div className="sticky-column-wrapper grid grid-cols-7 span-cols-7">
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
                .with({ type: "grey-section" }, (block) => (
                    <div className={getLayout("grey-section")}>
                        {block.items.map((item, i) => (
                            <ArticleBlock key={i} b={item} />
                        ))}
                    </div>
                ))
                .exhaustive()

            // if (_type === "chart-grid") {
            //     let columns = 1
            //     try {
            //         columns =
            //             +b.value.find(
            //                 (_d: OwidRawArticleBlock) => _d.type === "columns"
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
            //                 .filter((_d: OwidRawArticleBlock) => _d.type === "chart")
            //                 .map((_d: OwidRawArticleBlock, i: number) => {
            //                     return <Chart d={_d} key={i} />
            //                 })}
            //         </div>
            //     )

            return content
        }
    }

    return <BlockErrorBoundary>{handleArchie(b, "")}</BlockErrorBoundary>
}
