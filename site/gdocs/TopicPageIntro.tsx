import {
    EnrichedTopicPageIntroRelatedTopic,
    EnrichedBlockTopicPageIntro,
} from "@ourworldindata/utils"
import React, { useContext } from "react"
import { useLinkedDocument } from "./utils.js"
import { DocumentContext } from "./OwidGdoc.js"
import Paragraph from "./Paragraph.js"

type TopicPageIntroProps = EnrichedBlockTopicPageIntro & {
    className?: string
}

function TopicPageRelatedTopic({
    text,
    url,
}: EnrichedTopicPageIntroRelatedTopic) {
    const { linkedDocument, errorMessage } = useLinkedDocument(url)
    const { isPreviewing } = useContext(DocumentContext)
    if (errorMessage && isPreviewing) {
        return <li>{errorMessage}</li>
    }
    const topicText = linkedDocument?.content.title || text
    const topicUrl = `/${linkedDocument?.slug}` || url
    return (
        <li>
            <a href={topicUrl}>{topicText}</a>
        </li>
    )
}

export function TopicPageIntro(props: TopicPageIntroProps) {
    return (
        <div className={props.className} id="introduction">
            <div className="topic-page-intro__content body-1-regular span-cols-6 span-md-cols-8 span-sm-cols-12">
                {props.content.map((text, i) => (
                    <Paragraph d={text} key={i} />
                ))}
            </div>
            <div className="topic-page-intro__links col-start-9 span-cols-4 col-md-start-1 span-md-cols-12">
                {props.downloadButton ? (
                    <div className="topic-page-intro__download-button">
                        <a>{props.downloadButton.text}</a>
                    </div>
                ) : null}
                {props.relatedTopics ? (
                    <aside className="topic-page-intro__related-topics">
                        <h4 className="overline-black-caps">Related topics</h4>
                        <ul>
                            {props.relatedTopics.map((relatedTopic) => (
                                <TopicPageRelatedTopic
                                    key={relatedTopic.url}
                                    {...relatedTopic}
                                />
                            ))}
                        </ul>
                    </aside>
                ) : null}
            </div>
        </div>
    )
}
