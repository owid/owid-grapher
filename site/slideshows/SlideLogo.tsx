import { OWID_LOGO_SVG, OWID_WORDMARK_SVG } from "@ourworldindata/grapher"

/**
 * Handles rendering either within a slide, or out in the .slides container when the slide is a cover.
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
            className="slide-logo"
            dangerouslySetInnerHTML={{ __html: OWID_LOGO_SVG }}
        />
    )
}
