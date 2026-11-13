import { Tippy } from "@ourworldindata/utils"

import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import type { WelfareType } from "../core/types.js"
import { WELFARE_TYPE_DETAILS } from "../core/welfareType.js"
import type { WelfareSentenceSegment } from "../core/welfareSentence.js"

/** Like OWID's details-on-demand tooltips (DOD_TIPPY_PROPS in @ourworldindata/components) */
export const WELFARE_DOD_TIPPY_PROPS: Partial<
    React.ComponentProps<typeof Tippy>
> = {
    // A hide delay, so the pointer can reach the card in tricky edge cases
    // such as a term that wraps onto two lines
    delay: [null, 200],
    interactive: true,
    hideOnClick: false,
    arrow: false,
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
            <p className="income-distribution-dod-card__body">{description}</p>
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
