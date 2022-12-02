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
        <ul className={cx("sdg-grid", className)}>
            {d.items.map((tile: { goal: string; link: string }, i: number) => {
                return (
                    <SDGTile
                        key={i}
                        number={i + 1}
                        goal={tile.goal}
                        link={tile.link}
                    />
                )
            })}
        </ul>
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
            className="span-cols-2 span-lg-cols-4 span-sm-cols-8 col-sm-start-3"
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
