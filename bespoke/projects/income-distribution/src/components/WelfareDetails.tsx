import { useQuery } from "@tanstack/react-query"
import { fetchJson, readFromAssetMap, Tippy } from "@ourworldindata/utils"
import {
    MarkdownTextWrap,
    MarkdownTextWrapHtml,
} from "@ourworldindata/components"
import type {
    ArchiveMetaInformation,
    DetailDictionary,
} from "@ourworldindata/types"

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
 * The site's details-on-demand dictionary, as the site loads it into
 * window.details (detailsOnDemand.tsx in @ourworldindata/components), or
 * fetched here if the site hasn't yet. Undefined where there's none, as on
 * the dev demo page.
 */
function useSiteDods(): DetailDictionary | undefined {
    const { data } = useQuery({
        queryKey: ["income-distribution", "dods"],
        queryFn: async (): Promise<DetailDictionary> =>
            window.details ?? (await fetchJson<DetailDictionary>(dodsUrl())),
        staleTime: Infinity,
        retry: false,
    })
    return data
}

/**
 * Where the site's DoD dictionary is: an archived page's hashed copy, from
 * its runtime asset map, as site/detailsOnDemand.tsx resolves it
 */
function dodsUrl(): string {
    const archiveContext = (
        window as { _OWID_ARCHIVE_CONTEXT?: ArchiveMetaInformation }
    )._OWID_ARCHIVE_CONTEXT
    return readFromAssetMap(archiveContext?.assets?.runtime, {
        path: "dods.json",
        fallback: "/dods.json",
    })
}

/**
 * A term with one of the site's details on demand, managed in the admin,
 * styled like the welfare types' cards. Plain text when the DoD isn't there.
 */
export function SiteDodTerm({
    id,
    children,
}: {
    id: string
    children: React.ReactNode
}): React.ReactElement {
    // The card mounts in the shadow root, where the footer is
    const { ref, getTippyContainer } = useTippyContainer<HTMLSpanElement>()
    const dod = useSiteDods()?.[id]
    if (!dod) return <>{children}</>
    return (
        <span ref={ref}>
            <Tippy
                {...WELFARE_DOD_TIPPY_PROPS}
                content={
                    <div className="income-distribution-dod-card income-distribution-dod-card--markdown">
                        <MarkdownTextWrapHtml
                            textWrap={
                                new MarkdownTextWrap({
                                    text: dod.text,
                                    fontSize: 14,
                                    lineHeight: 1.55,
                                })
                            }
                        />
                    </div>
                }
                appendTo={getTippyContainer}
            >
                <span className="income-distribution-dod-span" tabIndex={0}>
                    {children}
                </span>
            </Tippy>
        </span>
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
