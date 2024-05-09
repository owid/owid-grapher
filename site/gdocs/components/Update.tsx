import React from "react"
import cx from "classnames"
import { EnrichedBlockUpdate } from "@ourworldindata/types"
import { ArticleBlocks } from "./ArticleBlocks.js"
import { formatAuthors, formatDate } from "@ourworldindata/utils"

const UpdateMeta = (props: {
    publishDate: Date | undefined
    authors: string[]
}) => {
    const publishedAt = props.publishDate
        ? formatDate(new Date(props.publishDate))
        : "Unpublished"

    return (
        <div className="span-cols-2 col-start-2 span-md-cols-10 col-md-start-3 span-sm-cols-14 col-sm-start-1 update-meta">
            <div>
                <span className="update-meta__published-at h6-black-caps">
                    {publishedAt}
                </span>
                <span className="update-meta__authors body-3-medium">
                    {formatAuthors({ authors: props.authors })}
                </span>
            </div>
        </div>
    )
}

export const Update = (props: EnrichedBlockUpdate & { className: string }) => {
    return (
        <div className={props.className}>
            <UpdateMeta
                publishDate={props.publishDate}
                authors={props.authors}
            />
            <div
                className={cx(
                    "span-cols-8 col-start-4 span-md-cols-10 col-md-start-3 span-sm-cols-14 col-sm-start-1 update-body"
                )}
            >
                <p className="h6-black-caps">Announcement</p>
                <h1 className="display-3-semibold">{props.title}</h1>
                <div className="update-blocks">
                    <ArticleBlocks blocks={props.content} />
                </div>
            </div>
        </div>
    )
}
