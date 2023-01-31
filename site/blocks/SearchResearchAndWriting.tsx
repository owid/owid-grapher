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
    _tags?: string[]
}

export const SearchResearchAndWriting = () => {
    const { hits } = useHits<AlgoliaHit>()

    if (!hits?.length) return null

    return (
        <>
            <h3>Research & Writing</h3>
            <div className="wp-block-group wp-block-research-and-writing">
                <div className="wp-block-group research-and-writing__top">
                    <div
                        className="wp-block-owid-card with-image"
                        data-no-lightbox=""
                    >
                        <ArticleCard article={hits[0]} className={"featured"} />
                    </div>
                    {hits.length >= 2 && (
                        <div className="wp-block-group research-and-writing__top-right">
                            <div
                                className="wp-block-owid-card"
                                data-no-lightbox=""
                            >
                                <ArticleCard article={hits[1]} />
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
                    )}
                </div>
                {hits.length >= 5 && (
                    <>
                        <h4 style={{ marginTop: 0 }}>More articles</h4>

                        <div className="wp-block-owid-grid research-and-writing__sub-category">
                            {hits.slice(5).map((hit) => (
                                <ArticleCard key={hit.objectID} article={hit} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

const ArticleCard = ({
    article,
    className,
}: {
    article: AlgoliaHit
    className?: string
}) => {
    const { title, excerpt, authors, slug } = article
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
                        <p>{excerpt}</p>

                        <p>{authors.join(", ")}</p>
                    </div>
                    <div style={{ marginTop: "8px" }}>
                        {article._tags
                            ? article._tags.map((tag) => (
                                  <span
                                      key={tag}
                                      className="tag ais-RefinementList-count"
                                  >
                                      {tag}
                                  </span>
                              ))
                            : null}
                    </div>
                </div>
            </a>
        </div>
    )
}
