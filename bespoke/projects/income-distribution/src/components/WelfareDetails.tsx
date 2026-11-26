import { Tippy } from "@ourworldindata/utils"
import { DOD_TIPPY_PROPS } from "@ourworldindata/components/src/detailsOnDemand.js"

import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import { DODS, type DodId, type NoteSegment } from "../core/dods.js"

// tippy.js types `content` and `render` more widely than the React wrapper
// does; the DoD props set neither
const { content: _content, render: _render, ...dodTippyProps } = DOD_TIPPY_PROPS

/** OWID's details-on-demand tooltips, with this project's theme (WelfareDetails.scss) */
export const WELFARE_DOD_TIPPY_PROPS: Partial<
    React.ComponentProps<typeof Tippy>
> = {
    ...dodTippyProps,
    theme: "light income-distribution-dod",
    maxWidth: 320,
}

/** A term's card (DODS), styled like OWID's .dod-container (WelfareDetails.scss) */
export function DodCard({ dod }: { dod: DodId }): React.ReactElement {
    const { title, description } = DODS[dod]
    return (
        <div className="income-distribution-dod-card">
            <div className="income-distribution-dod-card__title">{title}</div>
            {description.map((paragraph) => (
                <p
                    key={paragraph}
                    className="income-distribution-dod-card__body"
                >
                    {paragraph}
                </p>
            ))}
        </div>
    )
}

/**
 * The note's text with its terms (the welfare types, "nowcasts") as
 * dotted-underlined spans that show their card on hover or focus
 */
export function NoteWithDods({
    segments,
}: {
    segments: NoteSegment[]
}): React.ReactElement {
    // The cards mount in the shadow root, where the footer is
    const { ref, getTippyContainer } = useTippyContainer<HTMLSpanElement>()
    return (
        <span ref={ref}>
            {segments.map((segment, i) =>
                typeof segment === "string" ? (
                    segment
                ) : (
                    <Tippy
                        key={i}
                        {...WELFARE_DOD_TIPPY_PROPS}
                        content={<DodCard dod={segment.dod} />}
                        appendTo={getTippyContainer}
                    >
                        <span
                            className="income-distribution-dod-span"
                            tabIndex={0}
                        >
                            {DODS[segment.dod].term}
                        </span>
                    </Tippy>
                )
            )}
        </span>
    )
}
