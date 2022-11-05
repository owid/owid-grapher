import React from "react"

import ChartStory from "./ChartStory"
import Scroller from "./Scroller"
import Chart from "./Chart"
import PullQuote from "./PullQuote"
import FixedGraphic from "./FixedGraphic"
import Recirc from "./Recirc"
import List from "./List"
import Image from "./Image"
import { OwidArticleBlock, Span } from "@ourworldindata/utils"
import { match } from "ts-pattern"

function renderSpans(spans: Span[]) {
    return spans.map((span, i) =>
        match(span)
            .with({ type: "span-simple-text" }, (span) => (
                <React.Fragment key={i}>{span.text}</React.Fragment>
            ))
            .with({ type: "span-link" }, (span) => (
                <a key={i} href={span.url}>
                    {renderSpans(span.children)}
                </a>
            ))
            .with({ type: "span-newline" }, (span) => <br key={i} />)
            .with({ type: "span-italic" }, (span) => (
                <em key={i}>{renderSpans(span.children)}</em>
            ))
            .with({ type: "span-bold" }, (span) => (
                <strong key={i}>{renderSpans(span.children)}</strong>
            ))
            .with({ type: "span-underline" }, (span) => (
                <u key={i}>{renderSpans(span.children)}</u>
            ))
            .with({ type: "span-subscript" }, (span) => (
                <sub key={i}>{renderSpans(span.children)}</sub>
            ))
            .with({ type: "span-superscript" }, (span) => (
                <sup key={i}>{renderSpans(span.children)}</sup>
            ))
            .with({ type: "span-quote" }, (span) => (
                <q key={i}>{renderSpans(span.children)}</q>
            ))
            .with({ type: "span-fallback" }, (span) => (
                <React.Fragment key={i}>
                    {renderSpans(span.children)}
                </React.Fragment>
            ))
            .exhaustive()
    )
}

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
            .with({ type: "header", value: { level: 1 } }, (block) => (
                <h1>{block.value.text}</h1>
            ))
            .with({ type: "header", value: { level: 2 } }, (block) => (
                <h2>{block.value.text}</h2>
            ))
            .with({ type: "header", value: { level: 3 } }, (block) => (
                <h3>{block.value.text}</h3>
            ))
            .with({ type: "header", value: { level: 4} }, (block) => (
                <h4>{block.value.text}</h4>
            ))
            .with({ type: "header", value: { level: 5 } }, (block) => (
                <h5>{block.value.text}</h5>
            ))
            .with({ type: "header", value: { level: 6  } }, (block) => (
                <h6>{block.value.text}</h6>
            ))
            .with({ type: "header" }, (block) => (
                // Should throw in the future but for now just for debugging
                <h3>
                    invalid header level - {block.value.text} -{" "}
                    {block.value.level}
                </h3>
            ))
            // .with({ type: "structured-text" }, (block) => (
            //     <React.Fragment>{renderSpans(block.value)}</React.Fragment>
            // ))
            .with({ type: "html" }, (block) => (
                <div dangerouslySetInnerHTML={{ __html: block.value }} />
            ))
            .with({ type: "horizontal-rule"}, () => (
                <hr></hr>
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
