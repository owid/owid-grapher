import React from "react"
import { Hit as AlgoliaHit } from "instantsearch.js/es/types"
import { Highlight } from "react-instantsearch-hooks-web"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

type HitProps = {
    hit: AlgoliaHit<{
        title: string
        _tags: string[]
        slug: string
    }>
}

export const TopicCard = ({ hit }: HitProps) => {
    return (
        <a href={`${BAKED_BASE_URL}/${hit.slug}`}>
            <div className="TopicCard">
                <div className="TopicCard__title">
                    <Highlight hit={hit} attribute="title" />
                </div>
            </div>
        </a>
    )
}
