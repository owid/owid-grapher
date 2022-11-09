import React from "react"
import { RawBlockImage } from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"

export default function Image({ d }: { d: RawBlockImage }) {
    return <img className={LIGHTBOX_IMAGE_CLASS} src={d.value.src} />
}
