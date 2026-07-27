import { useContext } from "react"
import { EnrichedBlockTopicPageIntro } from "@ourworldindata/utils"
import { AttachmentsContext } from "../AttachmentsContext.js"
import Paragraph from "./Paragraph.js"
import TopicNewsletterCard from "../../TopicNewsletterCard.js"

type TopicPageIntroProps = EnrichedBlockTopicPageIntro & {
    className?: string
}

export function TopicPageIntro(props: TopicPageIntroProps) {
    const { topicArea } = useContext(AttachmentsContext)
    return (
        <div className={props.className} id="introduction">
            <div className="topic-page-intro__content body-1-regular span-cols-6 span-md-cols-8 span-sm-cols-12">
                {props.content.map((text, i) => (
                    <Paragraph d={text} key={i} />
                ))}
            </div>
            <div className="topic-page-intro__links col-start-9 span-cols-4 col-md-start-1 span-md-cols-12">
                <TopicNewsletterCard
                    topicArea={topicArea}
                    className="topic-newsletter-card--topic-page-intro"
                />
                {props.downloadButton ? (
                    <div className="topic-page-intro__download-button">
                        <a href={props.downloadButton.url}>
                            {props.downloadButton.text}
                        </a>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
