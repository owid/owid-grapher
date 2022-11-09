import React from "react"
import { EnrichedBlockImage } from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"
import { renderSpans } from "./utils"

export default function Image({ d }: { d: EnrichedBlockImage }) {
    return <img className={LIGHTBOX_IMAGE_CLASS} src={d.src} />
}
