import React, { useState } from "react"
import { faCircleArrowRight } from "@fortawesome/free-solid-svg-icons/faCircleArrowRight"
import { faCircleArrowLeft } from "@fortawesome/free-solid-svg-icons/faCircleArrowLeft"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export default function ChartStory({ slides }: any) {
    // const [showDetails, setShowDetails] = useState(false);

    const [slide, setSlide] = useState(0)
    const showDetails = true

    const currentSlide = slides[slide]
    const maxSlide = slides.length - 1;

    console.log(slides, slide, `Chart ${slide + 1} of ${slides.length}`);

    return (
        <div className={"chartStory"}>
            <div
                className={"chart-story--nav-back"}
                onClick={() => {
                    setSlide(Math.max(0, slide - 1))
                }}
            >                
                <FontAwesomeIcon icon={faCircleArrowLeft} style={{fontSize: 18}} />
            </div>
            <div className={"chart-story--narrative-text"}>
                {currentSlide.narrative}
            </div>
            <div className={"chart-story--chart"}>
                <iframe
                    src={currentSlide.chart}
                    loading="lazy"
                    style={{ width: "100%", height: 550, border: "0px none" }}
                />
            </div>
            <div className={"chart-story--technical-text"}>
            </div>
            <div className={"chart-story--nav-hud"}>
                {`Chart ${slide + 1} of ${slides.length}`}
            </div>            
            <div
                className={"chart-story--nav-next"}
                onClick={() => {
                    setSlide(Math.min(maxSlide, slide + 1))
                }}
            >
                <FontAwesomeIcon icon={faCircleArrowRight} style={{fontSize: 18}} />
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
