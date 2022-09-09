import React from "react"
import { OwidArticleBlock } from "./gdoc-types.js"

export default function Image({ d }: { d: OwidArticleBlock }) {
    return <img className="lightbox-image" src={d.value.src} />
}
