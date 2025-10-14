import { OwidGdocAnnouncementInterface } from "@ourworldindata/utils"
import * as React from "react"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import DataInsightDateline from "../components/DataInsightDateline.js"
import LinkedAuthor from "../components/LinkedAuthor.js"
import { Cta } from "../components/Cta.js"

type AnnouncementProps = {
    className?: string
} & Omit<
    OwidGdocAnnouncementInterface,
    "markdown" | "publicationContext" | "revisionId"
>

export const AnnouncementPageContent = (props: AnnouncementProps) => {
    const { publishedAt } = props
    return (
        <div className="announcement-page-content span-cols-6 col-start-5 span-md-cols-8 col-md-start-4 span-sm-cols-14 col-sm-start-1">
            <header className="span-cols-6 col-start-5 span-md-cols-8 col-md-start-4 span-sm-cols-14 col-sm-start-1">
                <div className="announcement-page-header-meta">
                    <DataInsightDateline
                        publishedAt={publishedAt}
                        formatOptions={{
                            year: "numeric",
                            month: "long",
                            day: "2-digit",
                        }}
                    />
                    <span className="announcement-page-kicker h6-black-caps">
                        {props.content.kicker}
                    </span>
                </div>
                <h1 className="announcement-page-heading subtitle-2-bold">
                    {props.content.title}
                </h1>
                {props.content.authors.length && (
                    <div className="data-insight-authors body-3-medium">
                        {props.content.authors.map((author, index) => (
                            <LinkedAuthor
                                className="data-insight-author"
                                key={index}
                                name={author}
                                includeImage={true}
                            />
                        ))}
                    </div>
                )}
            </header>
            {props.content.cta &&
            props.content.cta.url &&
            props.content.cta.text ? (
                <>
                    <p>{props.content.excerpt}</p>
                    <Cta
                        shouldRenderLinks
                        text={props.content.cta.text}
                        url={props.content.cta.url}
                    />
                </>
            ) : (
                <ArticleBlocks
                    blocks={props.content.body}
                    interactiveImages={false}
                />
            )}
        </div>
    )
}

export const AnnouncementPage = (
    props: AnnouncementProps
): React.ReactElement => {
    return (
        <div className="announcement-page grid grid-cols-12-full-width">
            <AnnouncementPageContent {...props} />
        </div>
    )
}
