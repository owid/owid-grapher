import * as React from "react"

import { EnrichedBlockPerson } from "@ourworldindata/types"
import { ArticleBlocks } from "./ArticleBlocks.js"
import Image from "./Image.js"
import { useMediaQuery } from "usehooks-ts"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../../SiteConstants.js"
import { Socials } from "./Socials.js"

export default function Person({ person }: { person: EnrichedBlockPerson }) {
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)

    const header = (
        <div className="person-header">
            <h3 className="person-heading h2-bold">{person.name}</h3>
            {person.title && (
                <span className="person-title">{person.title}</span>
            )}
        </div>
    )

    return (
        <div className="person">
            {person.image && (
                <div className="person-image-container">
                    <Image
                        className="person-image"
                        filename={person.image}
                        containerType="person"
                        shouldLightbox={false}
                    />
                    {isSmallScreen && header}
                </div>
            )}
            <div>
                {(!person.image || !isSmallScreen) && header}
                <ArticleBlocks blocks={person.text} />
                {person.socials && (
                    <Socials
                        className="person-socials"
                        links={person.socials}
                    />
                )}
            </div>
        </div>
    )
}
