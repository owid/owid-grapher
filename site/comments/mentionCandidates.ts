import { AGENT_MENTION } from "@ourworldindata/types"

import { MentionableUser } from "./useComments.js"

/** What "@claude" inserts, and how it reads in the picker */
const AGENT_CANDIDATE: MentionableUser = {
    fullName: AGENT_MENTION.replace(/^@/, ""),
}

/**
 * Who the mention picker offers, the agent included.
 *
 * The agent is not in the users list and shouldn't be: its account is inactive,
 * which is what keeps it out of every other place the admin lists people. But it
 * is the mention people reach for most, and leaving it out means the one mention
 * that does something is the one you have to know to type.
 *
 * It sorts first when it matches, since a comment addressed to it is a request
 * rather than a notification.
 */
export function mentionCandidates(
    users: MentionableUser[],
    query: string
): MentionableUser[] {
    const matches = (name: string): boolean =>
        name.toLowerCase().includes(query.toLowerCase())
    return [
        ...(matches(AGENT_CANDIDATE.fullName) ? [AGENT_CANDIDATE] : []),
        ...users.filter((user) => matches(user.fullName)),
    ]
}
