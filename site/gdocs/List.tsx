import React from "react"
import { OwidArticleBlock } from "@ourworldindata/utils"

export default function List({ d }: { d: OwidArticleBlock }) {
    return (
        <ul className={"list"}>
            {d.value.map((_d: string, i: number) => {
                return <li key={i}>{_d}</li>
            })}
        </ul>
    )
}
