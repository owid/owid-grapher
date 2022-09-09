import React, { useState } from "react"
import { OwidArticleBlock } from "./gdoc-types.js"

import Lightbox from "react-image-lightbox"

export default function Image({ d }: { d: OwidArticleBlock }) {
    const [isOpen, setIsOpen] = useState(false)

    if (isOpen) {
        return (
            <Lightbox
                mainSrc={d.value.src}
                onCloseRequest={() => setIsOpen(false)}
            />
        )
    }
    return <img src={d.value.src} onClick={() => setIsOpen(true)} />
}
