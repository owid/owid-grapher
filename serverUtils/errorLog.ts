import Bugsnag from "@bugsnag/js"

export const logErrorAndMaybeSendToBugsnag = async (err: any) => {
    console.error(err)
    Bugsnag.notify(err)
}

export const warn = (err: any) => console.warn(err)
