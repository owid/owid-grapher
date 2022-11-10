import React from "react"

import ChartStory from "./ChartStory"
import Scroller from "./Scroller"
import Chart from "./Chart"
import PullQuote from "./PullQuote"
import FixedGraphic from "./FixedGraphic"
import Recirc from "./Recirc"
import List from "./List"
import Image from "./Image"
import { OwidEnrichedArticleBlock } from "@ourworldindata/utils"
import SDGGrid from "./SDGGrid.js"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import { match } from "ts-pattern"
import { renderSpans } from "./utils"
import Paragraph from "./Paragraph.js"

export default function ArticleBlock({ b }: { b: OwidEnrichedArticleBlock }) {
    const handleArchie = (block: OwidEnrichedArticleBlock, key: string) => {
        block.type = block.type.toLowerCase() as any // this comes from the user and may not be all lowercase, enforce it here
        if (block.parseErrors.length > 0) {
            return (
                <div key={key} className={"error"}>
                    {block.parseErrors.map((e, i) => (
                        <div key={i}>
                            <h3>{block.type}</h3>
                            {e.message}
                        </div>
                    ))}
                </div>
            )
        } else {
            const content: JSX.Element | null = match(block)
                .with({ type: "aside" }, (aside) => (
                    <figure
                        key={key}
                        className={`aside-text ${
                            aside.position ? aside.position : ""
                        }`}
                    >
                        {aside.caption ? (
                            <figcaption>
                                {renderSpans(aside.caption)}
                            </figcaption>
                        ) : null}
                    </figure>
                ))
                .with({ type: "chart" }, (block) => (
                    <Chart d={block} key={key} />
                ))
                .with({ type: "scroller" }, (block) => (
                    <Scroller d={block} key={key} />
                ))
                .with({ type: "chart-story" }, (block) => (
                    <ChartStory key={key} d={block} />
                ))
                .with({ type: "fixed-graphic" }, (block) => (
                    <FixedGraphic d={block} key={key} />
                ))
                .with({ type: "image" }, (block) => (
                    <Image d={block} key={key} />
                ))
                .with({ type: "pull-quote" }, (block) => (
                    <PullQuote d={block} key={key} />
                ))
                .with({ type: "recirc" }, (block) => (
                    <Recirc d={block} key={key} />
                ))
                .with({ type: "list" }, (block) => <List d={block} key={key} />)
                .with({ type: "text" }, (block) => (
                    <Paragraph d={block} key={key} />
                ))
                .with({ type: "header", level: 1 }, (block) => (
                    <h1>{block.text.text}</h1>
                ))
                .with({ type: "header", level: 2 }, (block) => (
                    <h2>{block.text.text}</h2>
                ))
                .with({ type: "header", level: 3 }, (block) => (
                    <h3>{block.text.text}</h3>
                ))
                .with({ type: "header", level: 4 }, (block) => (
                    <h4>{block.text.text}</h4>
                ))
                .with({ type: "header", level: 5 }, (block) => (
                    <h5>{block.text.text}</h5>
                ))
                .with({ type: "header", level: 6 }, (block) => (
                    <h6>{block.text.text}</h6>
                ))
                .with(
                    { type: "header" },
                    // during parsing we take care of level being in a valid range
                    () => null
                )
                .with({ type: "html" }, (block) => (
                    <div dangerouslySetInnerHTML={{ __html: block.value }} />
                ))
                .with({ type: "horizontal-rule" }, () => <hr></hr>)
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

    return handleArchie(b, "")
}
