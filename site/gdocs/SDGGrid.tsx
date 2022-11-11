import React from "react"
import { EnrichedBlockSDGGrid } from "@ourworldindata/utils"
import cx from "classnames"

export default function SDGGrid({
    d,
    className = "",
}: {
    d: EnrichedBlockSDGGrid
    className?: string
}) {
    return (
        <div className={cx("sdg-grid", className)}>
            <h2>The 17 goals</h2>
            <ul>
                {d.items.map(
                    (tile: { goal: string; link: string }, i: number) => {
                        return (
                            <SDGTile
                                key={i}
                                number={i + 1}
                                goal={tile.goal}
                                link={tile.link}
                            />
                        )
                    }
                )}
            </ul>
        </div>
    )
}

const SDGTile = ({
    number,
    goal,
    link,
}: {
    number: number
    goal: string
    link: string
}) => {
    return (
        <li
            className="tile"
            style={
                {
                    "--sdg-color": `var(--sdg-color-${number})`,
                } as React.CSSProperties
            }
            key={number}
        >
            <a href={link}>
                <span className="display-1-semibold number">{number}</span>
                <span className="h3-bold goal">{goal}</span>
            </a>
        </li>
    )
}
