import React from "react"
import { useHits } from "react-instantsearch-hooks-web"
import Trianglify from "react-trianglify"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

type AlgoliaHit = {
    objectID: string
    title: string
    excerpt: string
    authors: string[]
    slug: string
}

export const SearchResearchAndWriting = () => {
    const { hits } = useHits<AlgoliaHit>()

    if (!hits?.length) return null

    return (
        <div className="wp-block-group wp-block-research-and-writing">
            <div className="wp-block-group research-and-writing__top">
                <div
                    className="wp-block-owid-card with-image"
                    data-no-lightbox=""
                >
                    <ArticleCard
                        title={hits[0].title}
                        description={hits[0].excerpt}
                        authors={hits[0].authors}
                        slug={hits[0].slug}
                        className={"featured"}
                    />
                </div>
                <div className="wp-block-group research-and-writing__top-right">
                    <div className="wp-block-owid-card" data-no-lightbox="">
                        <ArticleCard
                            title={hits[1].title}
                            description={hits[1].excerpt}
                            authors={hits[1].authors}
                            slug={hits[1].slug}
                        />
                    </div>
                    <div className="wp-block-group">
                        <div className="wp-block-group research-and-writing__shorts">
                            <h5>More Key articles</h5>
                            {hits.slice(2, 5).map((hit) => (
                                <div
                                    key={hit.objectID}
                                    className="wp-block-group"
                                >
                                    <h6>
                                        <strong>
                                            <a
                                                href={`${BAKED_BASE_URL}/${hit.slug}`}
                                            >
                                                {hit.title}
                                            </a>
                                        </strong>
                                    </h6>

                                    <p>{hit.authors.join(", ")}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <h4 style={{ marginTop: 0 }}>More articles</h4>

            <div className="wp-block-owid-grid research-and-writing__sub-category">
                {hits.slice(5).map((hit) => (
                    <ArticleCard
                        key={hit.objectID}
                        title={hit.title}
                        description={hit.excerpt}
                        authors={hit.authors}
                        slug={hit.slug}
                    />
                ))}
            </div>
        </div>
    )
}

const ArticleCard = ({
    title,
    description,
    authors,
    slug,
    className,
}: {
    title: string
    description: string
    authors: string[]
    slug: string
    className?: string
}) => {
    return (
        <div className="wp-block-owid-card  with-image" data-no-lightbox="">
            <a className={className} href={`${BAKED_BASE_URL}/${slug}`}>
                <figure>
                    <Trianglify />
                </figure>
                <div className="text-wrapper">
                    <div className="title">
                        <strong>{title}</strong>
                    </div>
                    <div className="description">
                        <p>{description}</p>

                        <p>{authors.join(", ")}</p>
                    </div>
                </div>
            </a>
        </div>
    )
}
