import { useContext } from "react"
import * as React from "react"
import cx from "clsx"
import {
    Button as AriaButton,
    Disclosure,
    DisclosureGroup,
    DisclosurePanel,
} from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faPlus,
    faEarthAmericas,
    faChartLine,
    faTable,
    IconDefinition,
} from "@fortawesome/free-solid-svg-icons"

import {
    EnrichedBlockKeyIndicatorCollection,
    EnrichedBlockKeyIndicator,
    GRAPHER_TAB_CONFIG_OPTIONS,
} from "@ourworldindata/types"
import { Url, commafyNumber } from "@ourworldindata/utils"
import { isValidTabQueryParam } from "@ourworldindata/grapher"

import { useLinkedChart, useLinkedIndicator } from "../utils.js"
import KeyIndicator from "./KeyIndicator.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { Button } from "@ourworldindata/components"
import { SEARCH_BASE_PATH } from "../../search/searchUtils.js"

const tabIconMap: Record<"chart" | "map" | "table", IconDefinition> = {
    chart: faChartLine,
    map: faEarthAmericas,
    table: faTable,
}

export default function KeyIndicatorCollection({
    d,
    className,
}: {
    d: EnrichedBlockKeyIndicatorCollection
    className?: string
}) {
    const disclosureIds = d.blocks.map(
        (block: EnrichedBlockKeyIndicator) =>
            `key-indicator-collection_${Url.fromURL(block.datapageUrl).slug ?? ""}`
    )

    const { homepageMetadata } = useContext(AttachmentsContext)

    const { blocks } = d
    return (
        <section className={cx("key-indicator-collection", className)}>
            <header className="key-indicator-collection__header span-cols-8 span-sm-cols-12">
                <h2 className="h2-bold">Explore our data</h2>
                {homepageMetadata?.chartCount ? (
                    <p className="body-2-regular">
                        Featured data from our collection of{" "}
                        {commafyNumber(homepageMetadata.chartCount)} interactive
                        charts.
                    </p>
                ) : (
                    <p className="body-2-regular">
                        Featured data from our collection
                    </p>
                )}
            </header>
            <Button
                href={SEARCH_BASE_PATH}
                className="key-indicator-collection__all-charts-button body-3-medium span-cols-4 col-start-9 col-sm-start-1 span-sm-cols-12"
                text="See all our data"
                theme="outline-vermillion"
            />
            <DisclosureGroup
                className="span-cols-12"
                defaultExpandedKeys={disclosureIds.slice(0, 1)}
            >
                {blocks.map(
                    (block: EnrichedBlockKeyIndicator, blockIndex: number) => {
                        const disclosureId = disclosureIds[blockIndex]

                        return (
                            <AccordionItem
                                // assumes a key indicator doesn't appear twice on a page
                                id={disclosureId}
                                key={disclosureId}
                                block={block}
                            >
                                <KeyIndicator d={block} />
                            </AccordionItem>
                        )
                    }
                )}
            </DisclosureGroup>
        </section>
    )
}

function AccordionItem({
    id,
    block,
    children,
}: {
    id: string
    block: EnrichedBlockKeyIndicator
    children: React.ReactNode
}): React.ReactElement {
    return (
        <Disclosure
            id={id}
            className={({ isExpanded }) =>
                cx("accordion-item", {
                    "accordion-item--open": isExpanded,
                    "accordion-item--closed": !isExpanded,
                })
            }
        >
            {({ isExpanded }) => (
                <>
                    {/* desktop */}
                    <h3 className="accordion-item__heading">
                        <AriaButton
                            slot="trigger"
                            className="accordion-item__button"
                        >
                            <KeyIndicatorHeader
                                block={block}
                                isContentVisible={isExpanded}
                            />
                        </AriaButton>
                    </h3>
                    {/* mobile */}
                    {!isExpanded && (
                        <KeyIndicatorLink block={block}>
                            <KeyIndicatorHeader block={block} />
                        </KeyIndicatorLink>
                    )}
                    <DisclosurePanel
                        className="accordion-item__content"
                        role="region"
                    >
                        {children}
                    </DisclosurePanel>
                </>
            )}
        </Disclosure>
    )
}

function KeyIndicatorHeader({
    block,
    isContentVisible,
}: {
    block: EnrichedBlockKeyIndicator
    isContentVisible?: boolean
}) {
    const { linkedChart } = useLinkedChart(block.datapageUrl)
    const { linkedIndicator } = useLinkedIndicator(
        linkedChart?.indicatorId ?? 0
    )

    if (!linkedChart) return null
    if (!linkedIndicator) return null

    const { queryParams } = Url.fromURL(linkedChart.resolvedUrl)
    const tabFromQueryParams =
        queryParams.tab && isValidTabQueryParam(queryParams.tab)
            ? queryParams.tab
            : undefined
    const activeTab =
        tabFromQueryParams ||
        linkedChart.tab ||
        GRAPHER_TAB_CONFIG_OPTIONS.chart
    const activeTabType =
        activeTab === "table" || activeTab === "map" ? activeTab : "chart"

    const source = block.source || linkedIndicator.attributionShort

    return (
        <div className="key-indicator-header">
            <div className="key-indicator-header__left">
                <FontAwesomeIcon
                    icon={tabIconMap[activeTabType]}
                    className="key-indicator-header__tab-icon"
                />
                <div>
                    <span className="key-indicator-header__title">
                        {linkedIndicator.title}
                    </span>
                    {source && (
                        <>
                            {" "}
                            <span className="key-indicator-header__source">
                                {source}
                            </span>
                        </>
                    )}
                </div>
            </div>
            {!isContentVisible && (
                <div>
                    {/* desktop */}
                    <FontAwesomeIcon
                        icon={faPlus}
                        className="key-indicator-header__icon"
                    />
                    {/* mobile */}
                    <FontAwesomeIcon
                        icon={faArrowRight}
                        className="key-indicator-header__icon"
                    />
                </div>
            )}
        </div>
    )
}

function KeyIndicatorLink({
    block,
    children,
}: {
    block: EnrichedBlockKeyIndicator
    children: React.ReactNode
}) {
    const { linkedChart } = useLinkedChart(block.datapageUrl)
    const { linkedIndicator } = useLinkedIndicator(
        linkedChart?.indicatorId ?? 0
    )

    if (!linkedChart) return null
    if (!linkedIndicator) return null

    return (
        <a
            className="accordion-item__link-mobile"
            href={linkedChart.resolvedUrl}
        >
            {children}
        </a>
    )
}
