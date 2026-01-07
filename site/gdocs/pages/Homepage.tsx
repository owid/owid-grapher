import * as React from "react"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { OwidGdocHomepageContent } from "@ourworldindata/types"
import { getAllChildrenOfArea } from "@ourworldindata/utils"
import { AttachmentsContext } from "../AttachmentsContext.js"

export interface HomepageProps {
    content: OwidGdocHomepageContent
}

const AllTopicsSection = () => {
    const { homepageMetadata } = React.useContext(AttachmentsContext)
    if (!homepageMetadata) return null
    const { tagGraph } = homepageMetadata
    if (!tagGraph) return null

    // We have to flatten the areas because we can't nest <ul> elements and have them render correctly
    // Filter to only include topics (tags with slugs) - searchable non-topic tags shouldn't appear here
    const flattenedAreas = tagGraph.children.map((area) => ({
        ...area,
        children: getAllChildrenOfArea(area).filter((topic) => topic.isTopic),
    }))

    return (
        <section
            id="all-topics"
            className="grid grid-cols-12-full-width span-cols-14 homepage-topics-section"
        >
            <h2 className="h2-bold span-cols-12 col-start-2">All our topics</h2>
            <p className="body-2-regular span-cols-12 col-start-2">
                All our data, research, and writing — topic by topic.
            </p>
            {flattenedAreas.map((area) => (
                <section
                    key={area.name}
                    className="homepage-topic span-cols-12 col-start-2"
                >
                    <h2 className="homepage-topic__topic-name h3-bold">
                        {area.name}
                    </h2>
                    <ul className="homepage-topic__topic-list display-3-regular">
                        {area.children.map(({ slug, name }) =>
                            slug ? (
                                <li
                                    className="homepage-topic__topic-entry"
                                    key={`topic-entry-${slug}`}
                                >
                                    <a href={`/${slug}`}>{name}</a>
                                </li>
                            ) : (
                                <li
                                    className="homepage-topic__subtopic"
                                    key={`subarea-${name}`}
                                >
                                    {name}:
                                </li>
                            )
                        )}
                    </ul>
                </section>
            ))}
        </section>
    )
}

export const Homepage = (props: HomepageProps): React.ReactElement => {
    const { content } = props

    return (
        <div className="grid grid-cols-12-full-width">
            <ArticleBlocks blocks={content.body} />
            <AllTopicsSection />
        </div>
    )
}
