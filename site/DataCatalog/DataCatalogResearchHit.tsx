import { checkIsWordpressPageType, IPageHit } from "../search/searchTypes.js"
import { getCanonicalUrl } from "@ourworldindata/components"

export function DataCatalogResearchHit({ hit }: { hit: IPageHit }) {
    const href = checkIsWordpressPageType(hit.type)
        ? `/${hit.slug}`
        : getCanonicalUrl("", {
              slug: hit.slug,
              content: {
                  type: hit.type,
              },
          })
    return (
        <a href={href} className="data-catalog-research-hit">
            <div className="data-catalog-research-hit__content">
                <header className="data-catalog-research-hit__header">
                    <span className="data-catalog-research-hit__title">
                        {hit.title}
                    </span>
                </header>
                {/* {hit.excerpt && (
                    <p className="body-3-medium data-catalog-research-hit__excerpt">
                        {hit.excerpt}
                    </p>
                )} */}
            </div>
        </a>
    )
}
