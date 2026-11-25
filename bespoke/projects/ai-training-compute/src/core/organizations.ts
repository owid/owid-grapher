export const ORGANIZATION_GROUPS = [
    "OpenAI",
    "Google",
    "Meta",
    "Anthropic",
    "xAI",
    "Chinese AI labs",
    "Other companies",
    "Academia & others",
] as const

export type OrganizationGroup = (typeof ORGANIZATION_GROUPS)[number]

/**
 * Raw Epoch organization names that belong to a named group. Matching is
 * exact on the trimmed name, so a university called "Google-something" can't
 * slip in by accident.
 */
const NAMED_GROUP_MEMBERS: Partial<Record<OrganizationGroup, string[]>> = {
    OpenAI: ["OpenAI"],
    Google: [
        "Google",
        "Google Brain",
        "Google Research",
        "DeepMind",
        "Google DeepMind",
    ],
    Meta: ["Meta AI", "Facebook AI Research", "Facebook", "Meta"],
    Anthropic: ["Anthropic"],
    xAI: ["xAI"],
    "Chinese AI labs": [
        "Alibaba",
        "DeepSeek",
        "Baidu",
        "Tencent",
        "ByteDance",
        "Huawei",
        "Huawei Noah's Ark Lab",
        "Moonshot",
        "Z.ai (Zhipu AI)",
        "Zhipu AI",
        "MiniMax",
        "01.AI",
        "SenseTime",
        "iFlytek",
        "StepFun",
        "Beijing Academy of Artificial Intelligence / BAAI",
        "Shanghai AI Lab",
        "Xiaomi Corp",
        "Kuaishou",
        "Meituan Inc",
        "China Telecom",
        "Ant Group",
    ],
}

const GROUP_BY_ORGANIZATION = new Map<string, OrganizationGroup>(
    Object.entries(NAMED_GROUP_MEMBERS).flatMap(([group, members]) =>
        members.map((member) => [member, group as OrganizationGroup])
    )
)

/**
 * Assigns a model to one developer group. Co-developed models go to the
 * first listed organization that has a named group (so "University of X,
 * Google" counts as Google); failing that, industry involvement makes it
 * "Other companies".
 */
export function getOrganizationGroup(
    organization: string | null,
    organizationCategory: string | null
): OrganizationGroup {
    for (const name of splitNames(organization)) {
        const group = GROUP_BY_ORGANIZATION.get(name)
        if (group) return group
    }
    if (splitNames(organizationCategory).includes("Industry"))
        return "Other companies"
    return "Academia & others"
}

function splitNames(value: string | null): string[] {
    if (!value) return []
    return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
}
