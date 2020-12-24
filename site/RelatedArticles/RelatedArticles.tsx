import { PostReference } from "adminSite/client/ChartEditor"
import React from "react"

export const RelatedArticles = ({
    articles,
}: {
    articles: PostReference[]
}) => {
    return (
        <ul className="research">
            {articles.map((article) => (
                <li key={article.slug}>{article.title}</li>
            ))}
        </ul>
    )
}
