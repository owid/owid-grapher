import React from "react"
import { OwidArticleBlock } from "./gdoc-types.js"

export default function InfoBox({ d }: { d: OwidArticleBlock }) {
    return (
        <blockquote className={"pullQuote"}>
            {d.value.map((_d: string) => d.value).join("\n")}
        </blockquote>
    )
}
