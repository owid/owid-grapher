import { useContext } from "react"
import urljoin from "url-join"
import cx from "clsx"
import {
    EnrichedBlockAllCharts,
    ALL_CHARTS_ID,
    queryParamsToStr,
    getTopicPageHeading,
    sentenceCaseIfNotTopicPage,
} from "@ourworldindata/utils"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { useDocumentContext } from "../DocumentContext.js"
import { RelatedCharts } from "../../blocks/RelatedCharts.js"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.mjs"
import { Button } from "@ourworldindata/components"

type AllChartsProps = EnrichedBlockAllCharts & {
    className?: string
    id?: string
}

export function AllCharts({ className, id = ALL_CHARTS_ID }: AllChartsProps) {
    const { relatedCharts, tags } = useContext(AttachmentsContext)
    const { gdocType } = useDocumentContext()
    const defaultHeadingFragment = getTopicPageHeading("keyCharts", gdocType)
    const firstTag = tags[0]
    if (!firstTag || relatedCharts.length === 0) return null

    const firstTagDataCatalogQueryString = queryParamsToStr({
        topics: firstTag.name,
    })

    return (
        <section className={cx(className, "needs-dividers")}>
            <h1 className="article-block__heading h1-semibold" id={id}>
                <span>
                    {`${defaultHeadingFragment} on ${sentenceCaseIfNotTopicPage(firstTag.name, gdocType, false)}`}
                </span>
                <a className="deep-link" aria-labelledby={id} href={`#${id}`} />
            </h1>
            <Button
                theme="solid-vermillion"
                text="See all charts on this topic"
                href={`${urljoin(BAKED_BASE_URL, `/data`, firstTagDataCatalogQueryString)}`}
            />
            <RelatedCharts showKeyChartsOnly={true} charts={relatedCharts} />
        </section>
    )
}
