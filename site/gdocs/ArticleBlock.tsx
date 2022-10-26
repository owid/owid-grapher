import React from "react"

import ChartStory from "./ChartStory"
import Scroller from "./Scroller"
import Chart from "./Chart"
import PullQuote from "./PullQuote"
import FixedGraphic from "./FixedGraphic"
import Recirc from "./Recirc"
import List from "./List"
import Image from "./Image"
import { OwidArticleBlock } from "@ourworldindata/utils"
import { match } from "ts-pattern"

export default function ArticleBlock({ b }: { b: OwidArticleBlock }) {
    const handleArchie = (block: OwidArticleBlock, key: string) => {
        block.type = block.type.toLowerCase() as any // this comes from the user and may not be all lowercase, enforce it here
        const content: JSX.Element | null = match(block)
            .with({ type: "aside" }, (aside) => (
                <figure
                    key={key}
                    className={`aside-text ${
                        aside.value.position ? aside.value.position : ""
                    }`}
                >
                    {aside.value.caption ? (
                        <figcaption>{aside.value.caption}</figcaption>
                    ) : null}
                </figure>
            ))
            .with({ type: "chart" }, (block) => <Chart d={block} key={key} />)
            .with({ type: "scroller" }, (block) => (
                <Scroller d={block} key={key} />
            ))
            .with({ type: "chart-story" }, (block) => (
                <ChartStory key={key} slides={block.value.slides} />
            ))
            .with({ type: "fixed-graphic" }, (block) => (
                <FixedGraphic d={block} key={key} />
            ))
            .with({ type: "image" }, (block) => <Image d={block} key={key} />)
            .with({ type: "pull-quote" }, (block) => (
                <PullQuote d={block} key={key} />
            ))
            .with({ type: "recirc" }, (block) => <Recirc d={block} key={key} />)
            .with({ type: "list" }, (block) => <List d={block} key={key} />)
            .with({ type: "text" }, (block) => {
                if (block.value.trim() === "") {
                    return null
                }
                return (
                    <div
                        dangerouslySetInnerHTML={{
                            __html:
                                block.value.startsWith("<div") ||
                                block.value.trim() === "<hr />"
                                    ? block.value.replace(/\\:/g, ":")
                                    : `<p>${block.value.replace(
                                          /\\:/g,
                                          ":"
                                      )}</p>`,
                        }}
                    />
                )
            })
            .with({ type: "url" }, (block) => (
                <a href={block.value}>{block.value}</a>
            ))
            .with({ type: "position" }, (block) => (
                <a href={block.value}>{block.value}</a>
            ))
            .exhaustive()

        // if (_type === "chart-grid") {
        //     let columns = 1
        //     try {
        //         columns =
        //             +b.value.find(
        //                 (_d: OwidArticleBlock) => _d.type === "columns"
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
        //                 .filter((_d: OwidArticleBlock) => _d.type === "chart")
        //                 .map((_d: OwidArticleBlock, i: number) => {
        //                     return <Chart d={_d} key={i} />
        //                 })}
        //         </div>
        //     )

        return content
    }

    return handleArchie(b, "")
}
