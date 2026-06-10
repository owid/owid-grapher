import React from "react"
import { OWID_LOGO_SVG, OWID_WORDMARK_SVG } from "@ourworldindata/grapher"

/**
 * Renders within a slide or out in the .slides container when the slide is SlideTemplate.Cover
 */
export function SlideLogo({
    coverSlideLogo = false,
}: {
    coverSlideLogo?: boolean
}): React.ReactElement {
    if (coverSlideLogo) {
        return (
            <span
                className="cover-slide-logo"
                dangerouslySetInnerHTML={{ __html: OWID_WORDMARK_SVG }}
            />
        )
    }
    return (
        <span
            className="slideshow-slide-logo"
            dangerouslySetInnerHTML={{ __html: OWID_LOGO_SVG }}
        />
    )
}
