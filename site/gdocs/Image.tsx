import React from "react"
import { OwidArticleBlock } from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"

export default function Image({ d }: { d: OwidArticleBlock }) {
    return <img className={LIGHTBOX_IMAGE_CLASS} src={d.value.src} />
}
