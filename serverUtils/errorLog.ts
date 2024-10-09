import Bugsnag from "@bugsnag/js"

export const logErrorAndMaybeSendToBugsnag = async (
    err: any,
    req?: any,
    // Sometimes Bugsnag's default grouping algorithm gets it wrong (e.g. all SiteBaker errors get grouped together).
    // Set a hash here to ensure that errors with the same hash will be grouped together / excluded from group they would otherwise be in.
    groupingHash?: string
) => {
    console.error(err)
    if (req) {
        req.bugsnag.notify(err)
    } else {
        Bugsnag.notify(err, (event) => {
            if (groupingHash) event.groupingHash = groupingHash
        })
    }
}

export const warn = (err: any) => console.warn(err)
