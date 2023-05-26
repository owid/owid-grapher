import Bugsnag from "@bugsnag/js"

export const logErrorAndMaybeSendToBugsnag = async (err: any, req?: any) => {
    console.error(err)
    if (req) {
        req.bugsnag.notify(err)
    } else {
        Bugsnag.notify(err)
    }
}

export const warn = (err: any) => console.warn(err)
