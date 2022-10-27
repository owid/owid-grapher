import React from "react"
import { OwidArticleBlock } from "../../clientUtils/owidTypes.js"

const sdgColors = [
    "#e5243b",
    "#dda63a",
    "#4c9f38",
    "#c5192d",
    "#ff3a21",
    "#26bde2",
    "#fcc30b",
    "#a21942",
    "#fd6925",
    "#dd1367",
    "#fd9d24",
    "#bf8b2e",
    "#3f7e44",
    "#0a97d9",
    "#56c02b",
    "#00689d",
    "#19486a",
]

export default function SDGGrid({ d }: { d: OwidArticleBlock }) {
    return (
        <ul className="sdg-grid">
            {d.value.map((tile: { goal: string }, i: number) => {
                return (
                    <SDGTile
                        key={i}
                        number={i + 1}
                        goal={tile.goal}
                        color={sdgColors[i]}
                    />
                )
            })}
        </ul>
    )
}

const SDGTile = ({
    number,
    goal,
    color,
}: {
    number: number
    goal: string
    color: string
}) => {
    const styleTile = {
        display: "flex",
        flexDirection: "column",
        "--color": color,
        border: "2px solid var(--color)",
        listStyleType: "none",
        height: "193px", // todo
        textAlign: "center",
        padding: "0 20px",
    } as React.CSSProperties

    const styleNumber = {
        display: "inline-block",
        margin: "0",
        textDecoration: "underline 2px solid var(--color-blue-20)",
        textUnderlineOffset: "24px",
    }

    const styleGoal = { margin: "auto" }

    return (
        <li className="sdg-grid--tile" style={styleTile} key={number}>
            <span className="display-1-semibold" style={styleNumber}>
                {number}
            </span>
            <span className="h3-bold" style={styleGoal}>
                {goal}
            </span>
        </li>
    )
}
