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
            </div>
        </div>
    )
}
