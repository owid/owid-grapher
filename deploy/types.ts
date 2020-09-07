export enum DeployStatus {
    queued = "queued",
    pending = "pending"
    // done = "done"
}

export interface DeployChange {
    authorName?: string
    authorEmail?: string
    message?: string
}

export interface Deploy {
    status: DeployStatus
    changes: DeployChange[]
}
