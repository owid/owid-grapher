import React from "react"
import { BlockPullQuote } from "@ourworldindata/utils"

export default function PullQuote({ d }: { d: BlockPullQuote }) {
    return (
        <blockquote className={"pullQuote"}>
            {d.value.map((d: any) => d.value).join("\n")}
        </blockquote>
    )
}
