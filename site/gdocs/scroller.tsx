import React, { useState } from "react"
import VisibilitySensor from "react-visibility-sensor"
import { OwidArticleBlock } from "./gdoc-types.js"

export default function Scroller({ d }: any) {
    let lastUrl: string
    const figureURLs = d.value.reduce(
        (memo: string[], { type, value }: OwidArticleBlock) => {
            if (type === "url") {
                lastUrl = value
            }
            if (type === "text") {
                memo = [...memo, lastUrl]
            }
            return memo
        },
        []
    )

    const [figureSrc, setFigureSrc] = useState(d.value[0].value)

    return (
        <section className={"stickySection"}>
            {figureSrc ? (
                <div className={"stickyFigure"}>
                    <iframe
                        src={figureSrc}
                        loading="lazy"
                        style={{
                            width: "100%",
                            height: "550px",
                            border: "0px none",
                        }}
                    />
                </div>
            ) : null}
            <div className={"stickyContent"}>
                {d.value
                    .filter((_d: OwidArticleBlock) => _d.type === "text")
                    .map(({ value }: OwidArticleBlock, i: number) => {
                        return (
                            <VisibilitySensor
                                key={i}
                                onChange={(isVisible: boolean) => {
                                    if (isVisible) {
                                        setFigureSrc(figureURLs[i])
                                    }
                                }}
                            >
                                <p>{value}</p>
                            </VisibilitySensor>
                        )
                    })}
            </div>
        </section>
    )
}
