import React, { useState } from "react"
import VisibilitySensor from "react-visibility-sensor"
// import styles from '../styles/Home.module.css'

export default function Scroller({ d, styles }: any) {
    let lastUrl: any
    const figureURLs = d.value.reduce((memo: any, { type, value }: any) => {
        if (type === "url") {
            lastUrl = value
        }
        if (type === "text") {
            memo = [...memo, lastUrl]
        }
        return memo
    }, [])

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
                    .filter((_d: any) => _d.type === "text")
                    .map(({ value }: any, i: any) => {
                        return (
                            <VisibilitySensor
                                key={i}
                                onChange={(isVisible: any) => {
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
