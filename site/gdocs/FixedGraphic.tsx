import React from "react"
import { EnrichedBlockFixedGraphic } from "@ourworldindata/utils"
import Image from "./Image.js"
import { match } from "ts-pattern"
import Chart from "./Chart.js"
import Paragraph from "./Paragraph.js"
import cx from "classnames"

export default function FixedSection({
    d,
    className = "",
}: {
    d: EnrichedBlockFixedGraphic
    className?: string
}) {
    const graphic = match(d.graphic)
        .with({ type: "image" }, (image) => <Image d={image}></Image>)
        .with({ type: "chart" }, (chart) => <Chart d={chart}></Chart>)
        .exhaustive()
    return (
        <section className={cx("fixed-section ", d.position, className)}>
            <div className={"fixed-section__graphic"}>{graphic}</div>
            <div className={"fixed-section__content"}>
                {d.text.map((item, i) => (
                    <Paragraph d={item} key={i}></Paragraph>
                ))}
            </div>
        </section>
    )
}
