/**
 *
 * DO NOT USE - DEPRECATED - FOR DOCUMENTATION PURPOSES ONLY
 *
 * Note: This file contains now deprecated functions that were querying the Wordpress
 * tables or APIs. It is kept around for easier reference during the transition period
 * but should not be used for new code.
 */

import {
    WP_PostType,
    FilterFnPostRestApi,
    PostRestApi,
    FullPost,
    JsonError,
    Topic,
} from "@ourworldindata/types"
import { BLOG_SLUG } from "../settings/serverSettings.js"
import {
    WP_API_ENDPOINT,
    apiQuery,
    getPostApiBySlugFromApi,
    isWordpressAPIEnabled,
    singleton,
    OWID_API_ENDPOINT,
    getEndpointSlugFromType,
    getBlockApiFromApi,
    graphqlQuery,
    ENTRIES_CATEGORY_ID,
} from "./wpdb.js"
import { getFullPost } from "./model/Post.js"

// Limit not supported with multiple post types: When passing multiple post
// types, the limit is applied to the resulting array of sequentially sorted
// posts (all blog posts, then all pages, ...), so there will be a predominance
// of a certain post type.
export const DEPRECATEDgetPosts = async (
    postTypes: string[] = [WP_PostType.Post, WP_PostType.Page],
    filterFunc?: FilterFnPostRestApi,
    limit?: number
): Promise<PostRestApi[]> => {
    if (!isWordpressAPIEnabled) return []

    const perPage = 20
    const posts: PostRestApi[] = []

    for (const postType of postTypes) {
        const endpoint = `${WP_API_ENDPOINT}/${getEndpointSlugFromType(
            postType
        )}`

        // Get number of items to retrieve
        const headers = await apiQuery(endpoint, {
            searchParams: [["per_page", 1]],
            returnResponseHeadersOnly: true,
        })
        const maxAvailable = headers.get("X-WP-TotalPages")
        const count = limit && limit < maxAvailable ? limit : maxAvailable

        for (let page = 1; page <= Math.ceil(count / perPage); page++) {
            const postsCurrentPage = await apiQuery(endpoint, {
                searchParams: [
                    ["per_page", perPage],
                    ["page", page],
                ],
            })
            posts.push(...postsCurrentPage)
        }
    }

    // Published pages excluded from public views
    const excludedSlugs = [BLOG_SLUG]

    const filterConditions: Array<FilterFnPostRestApi> = [
        (post): boolean => !excludedSlugs.includes(post.slug),
        (post): boolean => !post.slug.endsWith("-country-profile"),
    ]
    if (filterFunc) filterConditions.push(filterFunc)

    const filteredPosts = posts.filter((post) =>
        filterConditions.every((c) => c(post))
    )

    return limit ? filteredPosts.slice(0, limit) : filteredPosts
}

// We might want to cache this as the network of prominent links densifies and
// multiple requests to the same posts are happening.
export const DEPRECATEDgetPostBySlugFromApi = async (
    slug: string
): Promise<FullPost> => {
    if (!isWordpressAPIEnabled) {
        throw new JsonError(`Need wordpress API to match slug ${slug}`, 404)
    }

    const postApi = await getPostApiBySlugFromApi(slug)

    return getFullPost(postApi)
}

// the /revisions endpoint does not send back all the metadata required for
// the proper rendering of the post (e.g. authors), hence the double request.
export const DEPRECATEDgetLatestPostRevision = async (
    id: number
): Promise<FullPost> => {
    const type = await DEPRECATEDgetPostType(id)
    const endpointSlug = getEndpointSlugFromType(type)

    const postApi = await apiQuery(`${WP_API_ENDPOINT}/${endpointSlug}/${id}`)

    const revision = (
        await apiQuery(
            `${WP_API_ENDPOINT}/${endpointSlug}/${id}/revisions?per_page=1`
        )
    )[0]

    // Since WP does not store metadata for revisions, some elements of a
    // previewed page will not reflect the latest edits:
    // - published date (will show the correct one - that is the one in the
    //   sidebar - for unpublished posts though. For published posts, the
    //   current published date is displayed, regardless of what is shown
    //   and could have been modified in the sidebar.)
    // - authors
    // ...
    return getFullPost({
        ...postApi,
        content: revision.content,
        title: revision.title,
    })
}

export const DEPRECATEDgetTagsByPostId = async (): Promise<
    Map<number, string[]>
> => {
    const tagsByPostId = new Map<number, string[]>()
    const rows = await singleton.query(`
        SELECT p.id, t.name
        FROM wp_posts p
        JOIN wp_term_relationships tr
            on (p.id=tr.object_id)
        JOIN wp_term_taxonomy tt
            on (tt.term_taxonomy_id=tr.term_taxonomy_id
            and tt.taxonomy='post_tag')
        JOIN wp_terms t
            on (tt.term_id=t.term_id)
    `)

    for (const row of rows) {
        let cats = tagsByPostId.get(row.id)
        if (!cats) {
            cats = []
            tagsByPostId.set(row.id, cats)
        }
        cats.push(row.name)
    }

    return tagsByPostId
}

// Retrieve a map of post ids to authors
let cachedAuthorship: Map<number, string[]> | undefined
export const DEPRECATEDgetAuthorship = async (): Promise<
    Map<number, string[]>
> => {
    if (cachedAuthorship) return cachedAuthorship

    const authorRows = await singleton.query(`
        SELECT object_id, terms.description FROM wp_term_relationships AS rels
        LEFT JOIN wp_term_taxonomy AS terms ON terms.term_taxonomy_id=rels.term_taxonomy_id
        WHERE terms.taxonomy='author'
        ORDER BY rels.term_order ASC
    `)

    const authorship = new Map<number, string[]>()
    for (const row of authorRows) {
        let authors = authorship.get(row.object_id)
        if (!authors) {
            authors = []
            authorship.set(row.object_id, authors)
        }
        authors.push(row.description.split(" ").slice(0, 2).join(" "))
    }

    cachedAuthorship = authorship
    return authorship
}

// todo / refactor : narrow down scope to getPostTypeById?
export const DEPRECATEDgetPostType = async (
    search: number | string
): Promise<string> => {
    const paramName = typeof search === "number" ? "id" : "slug"
    return apiQuery(`${OWID_API_ENDPOINT}/type`, {
        searchParams: [[paramName, search]],
    })
}

let cachedFeaturedImages: Map<number, string> | undefined
export const DEPRECATEDgetFeaturedImages = async (): Promise<
    Map<number, string>
> => {
    if (cachedFeaturedImages) return cachedFeaturedImages

    const rows = await singleton.query(
        `SELECT wp_postmeta.post_id, wp_posts.guid FROM wp_postmeta INNER JOIN wp_posts ON wp_posts.ID=wp_postmeta.meta_value WHERE wp_postmeta.meta_key='_thumbnail_id'`
    )

    const featuredImages = new Map<number, string>()
    for (const row of rows) {
        featuredImages.set(row.post_id, row.guid)
    }

    cachedFeaturedImages = featuredImages
    return featuredImages
}

export const DEPRECATEDgetBlockContentFromApi = async (
    id: number
): Promise<string | undefined> => {
    if (!isWordpressAPIEnabled) return undefined

    const post = await getBlockApiFromApi(id)

    return post.data?.wpBlock?.content ?? undefined
}

export const DEPRECATEDgetTopics = async (
    cursor: string = ""
): Promise<Topic[]> => {
    if (!isWordpressAPIEnabled) return []

    const query = `query {
        pages (first: 100, after:"${cursor}", where: {categoryId:${ENTRIES_CATEGORY_ID}} ) {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                id: databaseId
                name: title
            }
        }
      }`

    const documents = await graphqlQuery(query, { cursor })
    const pageInfo = documents.data.pages.pageInfo
    const topics: Topic[] = documents.data.pages.nodes
    if (topics.length === 0) return []

    if (pageInfo.hasNextPage) {
        return topics.concat(await DEPRECATEDgetTopics(pageInfo.endCursor))
    } else {
        return topics
    }
}
