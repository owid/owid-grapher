import React from "react"
import { OwidArticleBlock } from "../../clientUtils/owidTypes.js"

export default function SDGGrid({ d }: { d: OwidArticleBlock }) {
    return (
        <ul className="sdg-grid">
            {d.value.map((tile: { goal: string; link: string }, i: number) => {
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
