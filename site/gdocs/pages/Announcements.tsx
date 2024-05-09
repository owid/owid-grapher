import { OwidGdocAnnouncementsInterface } from "@ourworldindata/utils"
import React from "react"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
type AnnouncementsProps = {
    className?: string
} & OwidGdocAnnouncementsInterface

export const AnnouncementsPage = (props: AnnouncementsProps): JSX.Element => {
    const content = props.content

    return (
        <div className="grid grid-cols-12-full-width announcements-page">
            <header className="announcements-page__header grid grid-cols-12-full-width span-cols-14">
                <h2 className="span-cols-8 col-start-4 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12 display-2-semibold ">
                    {props.content.title}
                </h2>
                <p className="span-cols-8 col-start-4 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12 body-1-regular">
                    {props.content.subtitle}
                </p>
            </header>

            {content.body ? <ArticleBlocks blocks={content.body} /> : null}
        </div>
    )
}
