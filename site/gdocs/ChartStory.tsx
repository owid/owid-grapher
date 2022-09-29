import React, { useState, useRef } from "react"
import { faCircleArrowRight } from "@fortawesome/free-solid-svg-icons/faCircleArrowRight"
import { faCircleArrowLeft } from "@fortawesome/free-solid-svg-icons/faCircleArrowLeft"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

import { useEmbedChart } from "../hooks.js"

export default function ChartStory({ slides }: any) {
    const [slide, setSlide] = useState(0)
    const showDetails = true

    const currentSlide = slides[slide]
    const maxSlide = slides.length - 1

    const refChartContainer = useRef<HTMLDivElement>(null)
    useEmbedChart(slide, refChartContainer)

    return (
        <div className={"chartStory"}>
            <div
                className={"chart-story--nav-back"}
                onClick={() => {
                    setSlide(Math.max(0, slide - 1))
                }}
            >
                <FontAwesomeIcon
                    icon={faCircleArrowLeft}
                    style={{ fontSize: 18 }}
                />
            </div>
            <div className={"chart-story--narrative-text"}>
                {currentSlide.narrative}
            </div>
            <div className={"chart-story--chart"}>
                <figure
                    // Use unique `key` to force React to re-render tree
                    key={currentSlide.chart}
                    data-grapher-src={currentSlide.chart}
                    style={{ width: "100%", height: 550, border: "0px none" }}
                />
            </div>
            <div className={"chart-story--technical-text"}></div>
            <div className={"chart-story--nav-hud"}>
                {`Chart ${slide + 1} of ${slides.length}`}
            </div>
            <div
                className={"chart-story--nav-next"}
                onClick={() => {
                    setSlide(Math.min(maxSlide, slide + 1))
                }}
            >
                <FontAwesomeIcon
                    icon={faCircleArrowRight}
                    style={{ fontSize: 18 }}
                />
            </div>
            {currentSlide.technical && showDetails ? (
                <div className={"chart-story--technical-details"}>
                    <ul>
                        {currentSlide.technical.map((d: any, i: number) => {
                            return <li key={i}>{d}</li>
                        })}
                    </ul>
                </div>
            ) : null}
        </div>
    )
}
