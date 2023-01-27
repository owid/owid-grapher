import React from "react"
import { Hit as AlgoliaHit } from "instantsearch.js/es/types"
import { Highlight } from "react-instantsearch-hooks-web"

type HitProps = {
    hit: AlgoliaHit<{
        title: string
        _tags: string[]
    }>
}

export const TopicCard = ({ hit }: HitProps) => {
    return (
        <div className="TopicCard">
            <div className="TopicCard__title">
                <Highlight hit={hit} attribute="title" />
                <div style={{ marginTop: "8px" }}>
                    {hit._tags.map((tag) => (
                        <span
                            key={tag}
                            className="tag ais-RefinementList-count"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
