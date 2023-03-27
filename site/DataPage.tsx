import React from "react"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { GrapherInterface, LoadingIndicator } from "@ourworldindata/grapher"
import { ExpandableAnimatedToggle } from "./ExpandableAnimatedToggle.js"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../settings/clientSettings.js"

export const DataPage = ({
    datapage,
    grapher,
}: {
    datapage: any
    grapher: GrapherInterface
}) => {
    return (
        <div className="DataPage">
            <div className="header__wrapper wrapper">
                <div className="header__left">
                    <div className="supertitle">DATA</div>
                    <h1>{datapage.title}</h1>
                    <div className="source">{datapage.sourceShortName}</div>
                </div>
                <div className="header__right">
                    <div className="label">SEE ALL DATA AND RESEARCH ON:</div>
                    <div className="topic-tags">
                        {datapage.topicTagsLinks.map((topic: any) => (
                            <a href={topic.url} key={topic.url}>
                                {topic.title}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            <div
                style={{
                    backgroundColor: "#f7f7f7",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div className="chart__wrapper wrapper">
                    <figure data-grapher-src={`/grapher/${grapher.slug}`}>
                        <LoadingIndicator />
                    </figure>
                    <noscript id="fallback">
                        <img
                            src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${grapher.slug}.svg`}
                        />
                        <p>Interactive visualization requires JavaScript</p>
                    </noscript>
                </div>
                <div className="key-info__wrapper wrapper">
                    <div className="key-info__left">
                        <h2>Key information</h2>
                        {datapage.keyInfoText && (
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: datapage.keyInfoText,
                                }}
                            />
                        )}
                        {!!datapage.faqs?.items?.length && (
                            <a className="learn-more" href="#faq">
                                Learn more in the FAQs
                                <FontAwesomeIcon icon={faArrowDown} />
                            </a>
                        )}
                        {datapage.sourceVariableDescription?.title &&
                            datapage.sourceVariableDescription?.content && (
                                <div style={{ marginTop: 8 }}>
                                    <ExpandableAnimatedToggle
                                        label={
                                            datapage.sourceVariableDescription
                                                .title
                                        }
                                        content={
                                            datapage.sourceVariableDescription
                                                .content
                                        }
                                    />
                                </div>
                            )}
                    </div>
                    <div className="key-info__right">
                        <div className="key-info__data">
                            <div className="title">Source</div>
                            <div className="name">
                                {datapage.sourceShortName}
                            </div>
                            {datapage.owidProcessingLevel && (
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: datapage.owidProcessingLevel,
                                    }}
                                ></div>
                            )}
                        </div>
                        <div className="key-info__data">
                            <div className="title">Date range</div>
                            <div>{datapage.dateRange}</div>
                        </div>
                        <div className="key-info__data">
                            <div className="title">Last updated</div>
                            <div>{datapage.lastUpdated}</div>
                        </div>
                        <div className="key-info__data">
                            <div className="title">Next expected update</div>
                            <div>{datapage.nextUpdate}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
