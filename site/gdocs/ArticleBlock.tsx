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
import SDGGrid from "./SDGGrid.js"

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
            let columns = 1
            try {
                columns =
                    +d.value.find(
                        (_d: OwidArticleBlock) => _d.type === "columns"
                    ).value || 1
            } catch (e) {}

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
            content = <ChartStory key={key} slides={d.value} />
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
        } else if (_type === "sdg-grid") {
            content = <SDGGrid d={d} key={key} />
        }

        return content
    }

    if (d.type === "text") {
        if (d.value.trim() === "") {
            return null
        }
        const makeRef = (index: string) =>
            `<a class="ref" id="ref-${index}" href="#note-${index}"><sup>${index}</sup></a>`
        return (
            <div
                dangerouslySetInnerHTML={{
                    __html:
                        d.value.startsWith("<div") ||
                        d.value.trim() === "<hr />"
                            ? d.value.replace(/\\:/g, ":")
                            : `<p>${d.value
                                  .replace(/\\:/g, ":")
                                  .replace(
                                      /<ref id="note-(\d+)" \/>/g,
                                      (_: string, index: string) =>
                                          makeRef(index)
                                  )}</p>`,
                }}
            />
        )
    } else {
        return handleArchie(d, "")
    }
}
