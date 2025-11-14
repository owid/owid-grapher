import { getCanonicalUrl } from "@ourworldindata/components"
import { PostReference } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

export const RelatedArticles = ({
    articles,
}: {
    articles: PostReference[]
}) => {
    return (
        <ul className="research">
            {articles.map((article) => (
                <li key={article.slug}>
                    <a
                        href={getCanonicalUrl(BAKED_BASE_URL, {
                            slug: article.slug,
                            content: {
                                type: article.type,
                            },
                        })}
                    >
                        {article.title}
                    </a>
                </li>
            ))}
        </ul>
    )
}
