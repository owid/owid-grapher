import * as React from "react"
import { Slide } from "@ourworldindata/types"

export function SlideshowPreviewTab(props: {
    slides: Slide[]
}): React.ReactElement {
    return (
        <div className="SlideshowPreviewTab">
            <p>
                Presentation mode preview coming soon. Use the main canvas to
                preview individual slides.
            </p>
            <p>{props.slides.length} slide(s) in this slideshow.</p>
        </div>
    )
}
