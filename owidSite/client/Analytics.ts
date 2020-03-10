declare var window: any

export class Analytics {
    static amplitudeSessionId(): string | undefined {
        return window.amplitude ? window.amplitude.getSessionId() : undefined
    }

    static logEvent(name: string, props?: any): Promise<void> {
        props = Object.assign(
            {},
            {
                context: {
                    pageHref: window.location.href,
                    pagePath: window.location.pathname,
                    pageTitle: document.title.replace(/ - [^-]+/, "")
                }
            },
            props
        )

        // Todo: switch to async/await when AmplitudeSDK switches off callbacks
        return new Promise((resolve, reject) => {
            if (!window.amplitude) {
                // console.log(name, props)
                resolve()
            } else {
                window.amplitude.getInstance().logEvent(name, props, () => {
                    resolve()
                })
            }
        })
    }
}
