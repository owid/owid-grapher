export type DecisionTreeNode<T> =
    | {
          type: "leaf"
          // `undefined` when no rule matches this path (see the empty-rules case
          // in buildTreeRecursive).
          target: T | undefined
      }
    | {
          type: "decision"
          paramName: string
          branches: Record<string, DecisionTreeNode<T>>
          default: DecisionTreeNode<T>
      }

export interface QueryParamMatchRule<T> {
    condition: Record<string, string | null>
    target: T
}

// A rule annotated with its overall priority (lower = more specific / higher priority),
// assigned once up front and threaded through recursion so that specificity ordering
// is preserved even after rules are partitioned and re-merged across different branches.
interface PrioritizedRule<T> {
    condition: Record<string, string | null>
    target: T
    priority: number
}

export function buildQueryParamDecisionTree<T>(
    rules: QueryParamMatchRule<T>[]
): DecisionTreeNode<T> {
    // Sort rules by specificity (descending number of non-null keys in condition).
    // This serves as our priority order: if multiple rules match, the most specific one should be chosen.
    // Specificity is computed once per rule up front rather than recomputed on every
    // comparison during the sort.
    const withSpecificity = rules.map((rule) => ({
        rule,
        specificity: Object.values(rule.condition).filter((v) => v !== null)
            .length,
    }))
    withSpecificity.sort((a, b) => b.specificity - a.specificity)

    const prioritizedRules: PrioritizedRule<T>[] = withSpecificity.map(
        ({ rule }, priority) => ({
            condition: rule.condition,
            target: rule.target,
            priority,
        })
    )

    return buildTreeRecursive(prioritizedRules, new Set())
}

// Merges two rule lists that are each already sorted ascending by priority (as
// subsequences of the original priority-sorted rule list) into a single list that
// remains sorted ascending by priority.
function mergeByPriority<T>(
    a: PrioritizedRule<T>[],
    b: PrioritizedRule<T>[]
): PrioritizedRule<T>[] {
    const merged: PrioritizedRule<T>[] = []
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
        merged.push(a[i].priority <= b[j].priority ? a[i++] : b[j++])
    }
    while (i < a.length) merged.push(a[i++])
    while (j < b.length) merged.push(b[j++])
    return merged
}

// Greedily builds a decision tree from a priority-sorted rule list:
// branch on the parameter that appears in the most remaining rules, partition the
// rules by that parameter's value, and recurse. A `null` condition value is a
// wildcard: such rules are propagated into every value branch *and* the default
// branch, so they match regardless of the parameter's value.
//
// `consumed` is the set of parameter names already branched on along the path to
// this node. It is a property of the path, identical for every rule here, so we
// thread it through the recursion instead of mutating each rule's condition. This
// keeps the input rule objects immutable and avoids per-rule/per-level object
// copies (and the dictionary-mode slowdown that copy-then-`delete` used to cause).
function buildTreeRecursive<T>(
    rules: PrioritizedRule<T>[],
    consumed: Set<string>
): DecisionTreeNode<T> {
    // If no rules remain, return a leaf with undefined.
    if (rules.length === 0) {
        return { type: "leaf", target: undefined }
    }

    // Choose the parameter name to branch on: the unconsumed key that appears in
    // the most remaining rules' conditions. A Map is used (rather than a plain
    // object) so that a condition key equal to an Object.prototype property name
    // (e.g. "__proto__") is counted correctly instead of silently colliding with
    // the prototype chain.
    const keyCounts = new Map<string, number>()
    for (const rule of rules) {
        for (const key of Object.keys(rule.condition)) {
            if (!consumed.has(key)) {
                keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
            }
        }
    }

    // No unconsumed keys means every remaining rule is a fallback; return the
    // highest-priority one (rules[0], since the list is priority-sorted).
    if (keyCounts.size === 0) {
        return { type: "leaf", target: rules[0].target }
    }

    let branchKey = ""
    let maxCount = -1
    for (const [key, count] of keyCounts) {
        if (count > maxCount) {
            maxCount = count
            branchKey = key
        }
    }

    // Partition the rules by their value for `branchKey`, without copying them.
    const matchingRulesByValue = new Map<string, PrioritizedRule<T>[]>()
    const fallbackRulesForBranch: PrioritizedRule<T>[] = []

    for (const rule of rules) {
        // `Object.hasOwn` (not `in`) so an absent key equal to a prototype property
        // name isn't mistaken for a present condition.
        if (Object.hasOwn(rule.condition, branchKey)) {
            const val = rule.condition[branchKey]
            if (val === null) {
                // Null acts as a wildcard, so it matches any value.
                // We add it to fallback rules so it gets propagated to all branches.
                fallbackRulesForBranch.push(rule)
            } else {
                let bucket = matchingRulesByValue.get(val)
                if (!bucket) {
                    bucket = []
                    matchingRulesByValue.set(val, bucket)
                }
                bucket.push(rule)
            }
        } else {
            fallbackRulesForBranch.push(rule)
        }
    }

    // All child nodes have branched on `branchKey`, so mark it consumed for them.
    const childConsumed = new Set(consumed)
    childConsumed.add(branchKey)

    // Build the branches recursively. Use a null-prototype object so that branch
    // values colliding with Object.prototype property names (e.g. "constructor")
    // become real own properties instead of touching the prototype chain.
    const branches: Record<string, DecisionTreeNode<T>> = Object.create(null)
    for (const [val, valRules] of matchingRulesByValue) {
        // Merge preserving priority order: both lists are already sorted ascending
        // by priority (as subsequences of `rules`), so a naive concatenation would
        // put every valRule ahead of every fallback rule regardless of which is
        // actually more specific overall.
        const combinedRules = mergeByPriority(valRules, fallbackRulesForBranch)
        branches[val] = buildTreeRecursive(combinedRules, childConsumed)
    }

    // Build the default branch recursively.
    const defaultNode = buildTreeRecursive(
        fallbackRulesForBranch,
        childConsumed
    )

    return {
        type: "decision",
        paramName: branchKey,
        branches,
        default: defaultNode,
    }
}

export function matchQueryParamDecisionTree<T>(
    tree: DecisionTreeNode<T>,
    queryParams: Record<string, string | null>
): T | undefined {
    let current = tree
    while (current.type === "decision") {
        const val = queryParams[current.paramName]
        // Use hasOwnProperty rather than `in` so that a query param value equal to
        // an Object.prototype property name (e.g. "constructor", "toString") isn't
        // spuriously treated as a matching branch.
        if (
            val !== undefined &&
            val !== null &&
            Object.prototype.hasOwnProperty.call(current.branches, val)
        ) {
            current = current.branches[val]
        } else {
            current = current.default
        }
    }
    return current.target
}

export function serializeDecisionTree<T>(tree: DecisionTreeNode<T>): string {
    return JSON.stringify(tree)
}

export function deserializeDecisionTree<T>(
    jsonStr: string
): DecisionTreeNode<T> {
    return JSON.parse(jsonStr) as DecisionTreeNode<T>
}
