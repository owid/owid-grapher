import React, { useState, useRef } from "react"
import { faCircleArrowRight } from "@fortawesome/free-solid-svg-icons/faCircleArrowRight"
import { faCircleArrowLeft } from "@fortawesome/free-solid-svg-icons/faCircleArrowLeft"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

import { useEmbedChart } from "../hooks.js"
import { RawBlockChartStory } from "@ourworldindata/utils"

export default function ChartStory({ d }: { d: RawBlockChartStory }) {
    const { value } = d
    const showDetails = true

    const [currentIndex, setCurrentIndex] = useState(0)
    const [currentSlide, setCurrentSlide] = useState(value[0])

    const maxSlide = value.length - 1

    const refChartContainer = useRef<HTMLDivElement>(null)
    useEmbedChart(currentIndex, refChartContainer)

    return (
        <div className={"chartStory"}>
            <div
                className={"chart-story--nav-back"}
                onClick={() => {
                    setCurrentSlide(value[Math.max(0, currentIndex - 1)])
                    setCurrentIndex(Math.max(0, currentIndex - 1))
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
            <div className={"chart-story--chart"} ref={refChartContainer}>
                <figure
                    key={currentSlide.chart}
                    data-grapher-src={currentSlide.chart}
                    style={{ width: "100%", height: 550, border: "0px none" }}
                />
            </div>
            <div className={"chart-story--technical-text"}></div>
            <div className={"chart-story--nav-hud"}>
                {`Chart ${currentIndex + 1} of ${value.length}`}
            </div>
            <div
                className={"chart-story--nav-next"}
                onClick={() => {
                    setCurrentSlide(value[Math.min(maxSlide, currentIndex + 1)])
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
                            return <li key={i}>{d}</li>
                        })}
                    </ul>
                </div>
            ) : null}
        </div>
    )
}
