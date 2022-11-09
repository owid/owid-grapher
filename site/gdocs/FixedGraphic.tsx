import React from "react"
import ArticleBlock from "./ArticleBlock"
import {
    OwidEnrichedArticleBlock,
    EnrichedBlockFixedGraphic,
} from "@ourworldindata/utils"
import { renderSpans } from "./utils"
import Image from "./Image.js"
import { match } from "ts-pattern"
import Chart from "./Chart.js"
import Paragraph from "./Paragraph.js"

export default function FixedSection({ d }: { d: EnrichedBlockFixedGraphic }) {
    const graphic = match(d.graphic)
        .with({ type: "image" }, (image) => <Image d={image}></Image>)
        .with({ type: "chart" }, (chart) => <Chart d={chart}></Chart>)
        .exhaustive()
    return (
        <section className={`fixedSection ${d.position ? d.position : ""}`}>
            <div className={"fixedSectionGraphic"}>{graphic}</div>
            <div className={"fixedSectionContent"}>
                {d.text.map((item, i) => (
                    <Paragraph d={item} key={i}></Paragraph>
                ))}
            </div>
        </section>
    )
}
