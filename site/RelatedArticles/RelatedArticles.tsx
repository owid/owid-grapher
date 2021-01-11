import React from "react"
import { PostReference } from "../../clientUtils/owidTypes"
import { BAKED_BASE_URL } from "../../settings/clientSettings"


export const RelatedArticles = ({
    articles,
}: {
    articles: PostReference[]
}) => {
    return (
        <ul className="research">
            {articles.map((article) => (
                <li key={article.slug}>
                    <a href={`${BAKED_BASE_URL}/${article.slug}`}>
                        {article.title}
                    </a>
                </li>
            ))}
        </ul>
    )
}
