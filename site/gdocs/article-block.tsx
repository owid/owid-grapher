import React from "react"

import { OwidArticleBlock } from "./gdoc-types.js"

import ChartStory from "./chart-story"
import Scroller from "./scroller"
import Chart from "./chart"
import PullQuote from "./pull-quote"
import FixedGraphic from "./fixed-graphic"
import Recirc from "./recirc"
import List from "./list"
import Image from "./image"

export default function ArticleBlock({ d }: { d: OwidArticleBlock }) {
    const handleArchie = (d: OwidArticleBlock, key: string) => {
        const _type = d.type.toLowerCase()
        let content: any = JSON.stringify(d)
        if (_type === "chart") {
            content = <Chart d={d} key={key} />
        } else if (_type === "aside") {
            content = (
                <figure
                    key={key}
                    className={`aside-text ${
                        d.value.position ? d.value.position : ""
                    }`}
                >
                    {d.value.caption ? (
                        <figcaption>{d.value.caption}</figcaption>
                    ) : null}
                </figure>
            )
        } else if (_type === "scroller") {
            content = <Scroller key={key} d={d} />
        } else if (_type === "chart-grid") {
            const columns = +d.value.find(
                (_d: OwidArticleBlock) => _d.type === "columns"
            ).value

            return (
                <div
                    key={key}
                    className={"chartGrid"}
                    style={{
                        display: "grid",
                        gridTemplateRows: "auto",
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    }}
                >
                    {d.value
                        .filter((_d: OwidArticleBlock) => _d.type === "chart")
                        .map((_d: OwidArticleBlock, i: number) => {
                            return <Chart d={_d} key={i} />
                        })}
                </div>
            )
        } else if (_type === "chart-story") {
            return <ChartStory key={key} slides={d.value} />
        } else if (_type === "pull-quote") {
            content = <PullQuote d={d} key={key} />
        } else if (_type === "fixed-graphic") {
            content = <FixedGraphic d={d} key={key} />
        } else if (_type === "recirc") {
            content = <Recirc d={d} key={key} />
        } else if (_type === "list") {
            content = <List d={d} key={key} />
        } else if (_type === "image") {
            content = <Image d={d} key={key} />
        }

        return content
    }

    if (d.type === "text") {
        if (d.value.trim() === "") {
            return null
        }
        return (
            <div
                dangerouslySetInnerHTML={{
                    __html:
                        d.value.startsWith("<div") ||
                        d.value.trim() === "<hr />"
                            ? d.value.replace(/\\:/g, ":")
                            : `<p>${d.value.replace(/\\:/g, ":")}</p>`,
                }}
            />
        )
    } else {
        return handleArchie(d, "")
    }
}
