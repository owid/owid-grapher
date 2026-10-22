// This function is duplicated in these places, make sure to change all of them:
//     https://github.com/owid/ops/blob/main/templates/lxc-manager/prune_staging_containers.py
//     https://github.com/owid/ops/blob/main/templates/lxc-manager/shared
//     https://github.com/owid/etl/blob/master/etl/config.py

export function normalizeBranch(branchName: string): string {
    return branchName.replace(/[/._]/g, "-")
}

export function getContainerName(branchName: string): string {
    let normalized = normalizeBranch(branchName)

    // Strip staging-site- prefix to add it back later
    normalized = normalized.replace(/^staging-site-/, "")

    // Truncate to 28 characters (Cloudflare's limit)
    const limit = 28
    const containerName = `staging-site-${normalized.slice(0, limit)}`

    // Remove trailing hyphens
    return containerName.replace(/-+$/, "")
}
