import React from "react"
import { RawBlockPullQuote } from "@ourworldindata/utils"

export default function PullQuote({ d }: { d: RawBlockPullQuote }) {
    return (
        <blockquote className={"pullQuote"}>
            {d.value.map((d: any) => d.value).join("\n")}
        </blockquote>
    )
}
