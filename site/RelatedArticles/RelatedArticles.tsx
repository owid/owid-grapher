import { PostReference } from "@ourworldindata/utils"

export const RelatedArticles = ({
    articles,
}: {
    articles: PostReference[]
}) => {
    return (
        <ul className="research">
            {articles.map((article) => (
                <li key={article.slug}>
                    <a href={article.url}>{article.title}</a>
                </li>
            ))}
        </ul>
    )
}
