import {
    useMutation,
    useQuery,
    useQueryClient,
    UseMutationResult,
    UseQueryResult,
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

export interface CommentThreadsData {
    threads: CommentThreadData[]
    unresolvedCount: number
    currentUserId: number
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

export function useCommentThreads(
    target: CommentTarget,
    { includeResolved = false }: { includeResolved?: boolean } = {}
): UseQueryResult<CommentThreadsData> {
    return useQuery({
        queryKey: [...commentsQueryKey(target), { includeResolved }],
        queryFn: () =>
            fetchJson<{
                comments: CommentWithAuthor[]
                currentUserId: number
            }>(
                `${COMMENTS_API_PATH}.json?targetType=${target.targetType}` +
                    `&targetId=${target.targetId}` +
                    `&includeResolved=${includeResolved}`
            ),
        select: ({ comments, currentUserId }) => {
            const threads = groupIntoThreads(comments)
            return {
                threads,
                unresolvedCount: threads.filter(
                    (thread) => !thread.root.resolvedAt
                ).length,
                currentUserId,
            }
        },
    })
}

function useInvalidateComments(target: CommentTarget): () => Promise<void> {
    const queryClient = useQueryClient()
    return () =>
        queryClient.invalidateQueries({ queryKey: commentsQueryKey(target) })
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
    const invalidate = useInvalidateComments(target)
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

export function useSetThreadResolved(
    target: CommentTarget
): UseMutationResult<unknown, Error, { id: number; resolved: boolean }> {
    const invalidate = useInvalidateComments(target)
    return useMutation({
        mutationFn: ({ id, resolved }) =>
            fetchJson(`${COMMENTS_API_PATH}/${id}/resolved`, {
                method: "PUT",
                body: JSON.stringify({ resolved }),
            }),
        onSuccess: invalidate,
    })
}

export function useDeleteComment(
    target: CommentTarget
): UseMutationResult<unknown, Error, { id: number }> {
    const invalidate = useInvalidateComments(target)
    return useMutation({
        mutationFn: ({ id }) =>
            fetchJson(`${COMMENTS_API_PATH}/${id}`, { method: "DELETE" }),
        onSuccess: invalidate,
    })
}
