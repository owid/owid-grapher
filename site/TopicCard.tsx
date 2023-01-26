import React from "react"
import { Hit as AlgoliaHit } from "instantsearch.js/es/types"

type HitProps = {
    hit: AlgoliaHit<{
        title: string
    }>
}

export const TopicCard = ({ hit }: HitProps) => {
    return (
        <div className="TopicCard">
            <div className="TopicCard__title">
                <h3>{hit.title}</h3>
            </div>
        </div>
    )
}
