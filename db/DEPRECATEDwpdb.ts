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
} from "@ourworldindata/types"
import { BLOG_SLUG } from "../settings/serverSettings.js"
import {
    WP_API_ENDPOINT,
    apiQuery,
    getEndpointSlugFromType,
    getFullPost,
    getPostApiBySlugFromApi,
    getPostType,
    isWordpressAPIEnabled,
} from "./wpdb.js"

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
    const type = await getPostType(id)
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
