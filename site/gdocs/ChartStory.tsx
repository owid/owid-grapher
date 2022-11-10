import React, { useState, useRef } from "react"
import { faCircleArrowRight } from "@fortawesome/free-solid-svg-icons/faCircleArrowRight"
import { faCircleArrowLeft } from "@fortawesome/free-solid-svg-icons/faCircleArrowLeft"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

import { useEmbedChart } from "../hooks.js"
import { EnrichedBlockChartStory } from "@ourworldindata/utils"
import { renderSpans } from "./utils"
import Chart from "./Chart.js"

export default function ChartStory({ d }: { d: EnrichedBlockChartStory }) {
    const { items } = d
    const showDetails = true

    const [currentIndex, setCurrentIndex] = useState(0)
    const [currentSlide, setCurrentSlide] = useState(items[0])

    const maxSlide = items.length - 1

    const refChartContainer = useRef<HTMLDivElement>(null)
    useEmbedChart(currentIndex, refChartContainer)

    return (
        <div className={"chartStory"}>
            <div
                className={"chart-story--nav-back"}
                onClick={() => {
                    setCurrentSlide(items[Math.max(0, currentIndex - 1)])
                    setCurrentIndex(Math.max(0, currentIndex - 1))
                }}
            >
                <FontAwesomeIcon
                    icon={faCircleArrowLeft}
                    style={{ fontSize: 18 }}
                />
            </div>
            <div className={"chart-story--narrative-text"}>
                {renderSpans(currentSlide.narrative.value)}
            </div>
            <div className={"chart-story--chart"} ref={refChartContainer}>
                <Chart d={currentSlide.chart} />
            </div>
            <div className={"chart-story--technical-text"}></div>
            <div className={"chart-story--nav-hud"}>
                {`Chart ${currentIndex + 1} of ${items.length}`}
            </div>
            <div
                className={"chart-story--nav-next"}
                onClick={() => {
                    setCurrentSlide(items[Math.min(maxSlide, currentIndex + 1)])
                    setCurrentIndex(Math.min(maxSlide, currentIndex + 1))
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
                            return <li key={i}>{renderSpans(d.value)}</li>
                        })}
                    </ul>
                </div>
            ) : null}
        </div>
    )
}
