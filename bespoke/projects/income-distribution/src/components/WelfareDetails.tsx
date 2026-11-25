import { Tippy } from "@ourworldindata/utils"
import { DOD_TIPPY_PROPS } from "@ourworldindata/components/src/detailsOnDemand.js"

import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import type { WelfareType } from "../core/types.js"
import { WELFARE_TYPE_DETAILS } from "../core/welfareType.js"
import type { WelfareSentenceSegment } from "../core/welfareSentence.js"

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

/** A welfare type's card, styled like OWID's .dod-container (WelfareDetails.scss) */
export function WelfareDetailsCard({
    welfareType,
}: {
    welfareType: WelfareType
}): React.ReactElement {
    const { title, description } = WELFARE_TYPE_DETAILS[welfareType]
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
 * The note's sentence on which countries report income and which
 * consumption (welfareTypeSentence), each type's term a dotted-underlined
 * span that shows its card on hover or focus
 */
export function WelfareSentence({
    segments,
}: {
    segments: WelfareSentenceSegment[]
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
                        content={
                            <WelfareDetailsCard
                                welfareType={segment.welfareType}
                            />
                        }
                        appendTo={getTippyContainer}
                    >
                        <span
                            className="income-distribution-dod-span"
                            tabIndex={0}
                        >
                            {WELFARE_TYPE_DETAILS[segment.welfareType].term}
                        </span>
                    </Tippy>
                )
            )}
        </span>
    )
}
