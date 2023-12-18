import React from "react"
import cx from "classnames"
import {
    EnrichedBlockKeyInsightsSlide,
    slugify,
    KEY_INSIGHTS_ID,
} from "@ourworldindata/utils"
import {
    KEY_INSIGHTS_CLASS_NAME,
    KEY_INSIGHTS_SLIDES_CLASS_NAME,
    KEY_INSIGHTS_SLIDE_CLASS_NAME,
    KEY_INSIGHTS_SLIDE_CONTENT_CLASS_NAME,
    KeyInsightsThumbs,
} from "../../blocks/KeyInsights.js"
import { ArticleBlocks } from "./ArticleBlocks.js"
import Image from "./Image.js"
import Chart from "./Chart.js"

type KeyInsightsProps = {
    className?: string
    insights: EnrichedBlockKeyInsightsSlide[]
    heading: string
}

export const KeyInsights = ({
    insights,
    heading,
    className,
}: KeyInsightsProps) => {
    function renderAssetForInsight({
        filename,
        url,
    }: {
        filename?: string
        url?: string
    }): JSX.Element | null {
        if (filename) {
            return (
                <Image
                    filename={filename}
                    containerType="sticky-right-left-column"
                />
            )
        }
        if (url) {
            return <Chart d={{ url, type: "chart", parseErrors: [] }} />
        }

        return null
    }
    return (
        <div className={className}>
            <h1
                className="article-block__heading h1-semibold"
                id={KEY_INSIGHTS_ID}
            >
                {heading}
                <a className="deep-link" href={`#${KEY_INSIGHTS_ID}`} />
            </h1>
            <div className={KEY_INSIGHTS_CLASS_NAME}>
                <div>
                    <KeyInsightsThumbs
                        titles={insights.map(({ title }) => title)}
                    />
                    <div className={KEY_INSIGHTS_SLIDES_CLASS_NAME}>
                        {insights.map(
                            ({ title, content, filename, url }, idx) => {
                                return (
                                    <div
                                        key={idx}
                                        className={cx(
                                            KEY_INSIGHTS_SLIDE_CLASS_NAME,
                                            "grid grid-cols-12 span-cols-12"
                                        )}
                                        data-active={idx === 0}
                                        role="tabpanel"
                                        tabIndex={0}
                                    >
                                        <div className="grid span-cols-12">
                                            <div className="article-block__key-insights-content-column span-cols-5 span-md-cols-12">
                                                <h4 id={slugify(title)}>
                                                    {title}
                                                </h4>
                                                <div
                                                    className={
                                                        KEY_INSIGHTS_SLIDE_CONTENT_CLASS_NAME
                                                    }
                                                >
                                                    <ArticleBlocks
                                                        blocks={content}
                                                        containerType="key-insight"
                                                    />
                                                </div>
                                            </div>
                                            <div className="span-cols-7 span-md-cols-12">
                                                {renderAssetForInsight({
                                                    filename,
                                                    url,
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
