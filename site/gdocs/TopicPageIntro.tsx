import { EnrichedBlockTopicPageIntro } from "@ourworldindata/utils"
import React from "react"
import { renderSpans } from "./utils.js"

type TopicPageIntroProps = EnrichedBlockTopicPageIntro & {
    className?: string
}

export function TopicPageIntro(props: TopicPageIntroProps) {
    return (
        <div className={props.className} id="introduction">
            <div className="topic-page-intro__content body-1-regular span-cols-6 span-md-cols-8 span-sm-cols-12">
                {props.content.map((spans, i) => (
                    <p key={i}>{renderSpans(spans)}</p>
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
                            {props.relatedTopics.map(({ text, url }) => (
                                <li key={text}>
                                    <a href={url}>{text}</a>
                                </li>
                            ))}
                        </ul>
                    </aside>
                ) : null}
            </div>
        </div>
    )
}
