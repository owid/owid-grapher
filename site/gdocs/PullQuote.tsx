import React from "react"
import { OwidArticleBlock } from "../../clientUtils/owidTypes.js"

export default function PullQuote({ d }: { d: OwidArticleBlock }) {
    return (
        <blockquote className={"pullQuote"}>
            {d.value.map((d: any) => d.value).join("\n")}
        </blockquote>
    )
}
