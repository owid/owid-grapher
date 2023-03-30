import React from "react"
import { Hits, useHits } from "react-instantsearch-hooks-web"
import { TopicCard } from "./TopicCard.js"

type AlgoliaHit = {
    objectID: string
    title: string
    excerpt: string
    authors: string[]
    slug: string
    tags?: string[]
}

export const SearchTopics = () => {
    const { hits } = useHits<AlgoliaHit>()

    if (!hits?.length) return null

    return (
        <>
            <h3>Topics</h3>
            <Hits hitComponent={TopicCard}></Hits>
        </>
    )
}
