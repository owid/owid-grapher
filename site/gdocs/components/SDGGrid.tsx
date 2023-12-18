import React from "react"
import { EnrichedBlockSDGGrid } from "@ourworldindata/utils"
import cx from "classnames"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"

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
    const sdgNumberPadded = number.toString().padStart(2, "0")
    const sdgIconUrl = `${BAKED_BASE_URL}/images/sdg-icons/sdg-icon-${sdgNumberPadded}.svg`

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
                <div
                    className="sdg-grid__icon"
                    style={{
                        mask: `url(${sdgIconUrl}) no-repeat center`,
                        WebkitMask: `url(${sdgIconUrl}) no-repeat center`,
                    }}
                />
                <h4 className="overline-black-caps">SDG {number}</h4>
                <span className="h3-bold goal">{goal}</span>
            </a>
        </li>
    )
}
