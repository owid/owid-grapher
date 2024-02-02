import { EnrichedBlockHomepageIntro } from "@ourworldindata/types"
import React from "react"

export type HomepageIntroProps = {
    className?: string
} & EnrichedBlockHomepageIntro

export function HomepageIntro(props: HomepageIntroProps) {
    const { className } = props
    return (
        <div className={className}>
            <div>
                <h2>Featured work</h2>
                {props.featuredWork.map((work, i) => (
                    <div key={i} style={{ outline: "1px solid red" }}>
                        <span>{work.kicker}</span>
                        <h3>{work.title}</h3>
                        <p>{work.description}</p>
                        <p>{work.authors?.join(", ")}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
