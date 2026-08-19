import {
    useMutation,
    useQuery,
    useQueryClient,
    UseMutationResult,
} from "@tanstack/react-query"
import {
    CommentTarget,
    CommentViewState,
    CommentWithAuthor,
} from "@ourworldindata/types"

// Both the admin SPA and the admin-served preview pages are same-origin with
// the admin API, so relative paths work in every host of this hook.
const COMMENTS_API_PATH = "/admin/api/comments"

export interface CommentThreadData {
    root: CommentWithAuthor
    replies: CommentWithAuthor[]
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
    })
    const json = await response.json().catch(() => undefined)
    if (!response.ok) {
        throw new Error(json?.error?.message ?? response.statusText)
    }
    return json
}

function groupIntoThreads(comments: CommentWithAuthor[]): CommentThreadData[] {
    const roots = comments.filter((comment) => comment.parentId === null)
    // Roots newest-first, replies in chronological order (as returned)
    return roots
        .map((root) => ({
            root,
            replies: comments.filter((comment) => comment.parentId === root.id),
        }))
        .reverse()
}

function commentsQueryKey(target: CommentTarget): (string | number)[] {
    return ["comments", target.targetType, target.targetId]
}

export interface PageCommentsData {
    threads: CommentThreadData[]
    currentUserId: number | undefined
    isLoading: boolean
    error: Error | undefined
}

function fetchCommentsForTarget(
    target: CommentTarget,
    includeResolved: boolean
): Promise<{ comments: CommentWithAuthor[]; currentUserId: number }> {
    return fetchJson(
        `${COMMENTS_API_PATH}.json?targetType=${target.targetType}` +
            `&targetId=${target.targetId}` +
            `&includeResolved=${includeResolved}`
    )
}

/**
 * Every comment on the page's subject - the chart or the multi-dim. There is
 * only ever one, since indicators are not commentable: metadata is commented on
 * as this chart or view shows it.
 */
export function useCommentThreadsForTarget(
    target: CommentTarget,
    { includeResolved = false }: { includeResolved?: boolean } = {}
): PageCommentsData {
    const result = useQuery({
        queryKey: [...commentsQueryKey(target), { includeResolved }],
        queryFn: () => fetchCommentsForTarget(target, includeResolved),
    })

    return {
        threads: result.data ? groupIntoThreads(result.data.comments) : [],
        currentUserId: result.data?.currentUserId,
        isLoading: result.isLoading,
        error: result.error ?? undefined,
    }
}

/** Invalidates the comment queries after a write */
function useInvalidateComments(): () => Promise<void> {
    const queryClient = useQueryClient()
    return () => queryClient.invalidateQueries({ queryKey: ["comments"] })
}

export type CreateCommentInput =
    | {
          content: string
          anchor?: string | null
          viewState?: CommentViewState | null
      }
    | { content: string; parentId: number }

export function useCreateComment(
    target: CommentTarget
): UseMutationResult<unknown, Error, CreateCommentInput> {
    const invalidate = useInvalidateComments()
    return useMutation({
        mutationFn: (input: CreateCommentInput) =>
            fetchJson(COMMENTS_API_PATH, {
                method: "POST",
                body: JSON.stringify(
                    "parentId" in input ? input : { ...target, ...input }
                ),
            }),
        onSuccess: invalidate,
    })
}

export function useSetThreadResolved(): UseMutationResult<
    unknown,
    Error,
    { id: number; resolved: boolean }
> {
    const invalidate = useInvalidateComments()
    return useMutation({
        mutationFn: ({ id, resolved }) =>
            fetchJson(`${COMMENTS_API_PATH}/${id}/resolved`, {
                method: "PUT",
                body: JSON.stringify({ resolved }),
            }),
        onSuccess: invalidate,
    })
}

export function useDeleteComment(): UseMutationResult<
    unknown,
    Error,
    { id: number }
> {
    const invalidate = useInvalidateComments()
    return useMutation({
        mutationFn: ({ id }) =>
            fetchJson(`${COMMENTS_API_PATH}/${id}`, { method: "DELETE" }),
        onSuccess: invalidate,
    })
}
