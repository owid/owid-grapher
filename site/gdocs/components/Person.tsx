import * as React from "react"
import { useMediaQuery } from "usehooks-ts"

import { getCanonicalUrl } from "@ourworldindata/components"
import { EnrichedBlockPerson, OwidGdocType } from "@ourworldindata/types"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../../SiteConstants.js"
import { useLinkedDocument } from "../utils.js"
import { ArticleBlocks } from "./ArticleBlocks.js"
import Image from "./Image.js"
import { Socials } from "./Socials.js"

export default function Person({ person }: { person: EnrichedBlockPerson }) {
    const { linkedDocument } = useLinkedDocument(person.url ?? "")
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)

    const slug = linkedDocument?.slug
    const url = slug
        ? getCanonicalUrl("", {
              slug,
              content: { type: OwidGdocType.Author },
          })
        : undefined

    const heading = <h3 className="person-heading">{person.name}</h3>

    const header = (
        <div className="person-header">
            {url ? <a href={url}>{heading}</a> : heading}
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
