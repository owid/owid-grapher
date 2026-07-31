import {
    useMutation,
    useQueries,
    useQueryClient,
    UseMutationResult,
} from "@tanstack/react-query"
import {
    CommentTarget,
    CommentViewState,
    CommentWithAuthor,
} from "@ourworldindata/types"
import { CommentPageTarget } from "./commentContext.js"

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

/** A thread plus the target it hangs off, for pages that show several */
export interface CommentThreadWithTarget extends CommentThreadData {
    target: CommentPageTarget
}

export interface PageCommentsData {
    threads: CommentThreadWithTarget[]
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
 * Comments for every target a page exposes. A chart page asks for the chart and
 * for each indicator it draws on, so metadata feedback left on an indicator's
 * own data page still shows up wherever that indicator is used.
 */
export function useCommentThreadsForTargets(
    targets: CommentPageTarget[],
    { includeResolved = false }: { includeResolved?: boolean } = {}
): PageCommentsData {
    const results = useQueries({
        queries: targets.map((target) => ({
            queryKey: [...commentsQueryKey(target), { includeResolved }],
            queryFn: () => fetchCommentsForTarget(target, includeResolved),
        })),
    })

    const threads: CommentThreadWithTarget[] = []
    results.forEach((result, index) => {
        if (!result.data) return
        for (const thread of groupIntoThreads(result.data.comments)) {
            threads.push({ ...thread, target: targets[index] })
        }
    })

    return {
        threads,
        currentUserId: results.find((r) => r.data)?.data?.currentUserId,
        isLoading: results.some((result) => result.isLoading),
        error: results.find((result) => result.error)?.error ?? undefined,
    }
}

/**
 * Invalidates every target's comments, not just one: a reply or a resolve can
 * affect a thread the page is showing under a different target.
 */
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
