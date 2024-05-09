import { OwidGdocAnnouncementsInterface } from "@ourworldindata/utils"
import React from "react"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
type AnnouncementsProps = {
    className?: string
} & OwidGdocAnnouncementsInterface

export const AnnouncementsPage = (props: AnnouncementsProps): JSX.Element => {
    const content = props.content

    return (
        <div className="grid grid-cols-12-full-width data-insight-page">
            <div className="span-cols-8 col-start-4 span-md-cols-10 col-md-start-3 col-sm-start-2 span-sm-cols-12 data-insight-breadcrumbs">
                <span>{props.content.title}</span>
            </div>
            {content.body ? <ArticleBlocks blocks={content.body} /> : null}
        </div>
    )
}
