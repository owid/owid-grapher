import React from "react"
import { BlockImage } from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"

export default function Image({ d }: { d: BlockImage }) {
    return <img className={LIGHTBOX_IMAGE_CLASS} src={d.value.src} />
}
