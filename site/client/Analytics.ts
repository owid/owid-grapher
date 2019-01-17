declare var window: any

export class Analytics {
    static logEvent(name: string, props?: any): Promise<void> {
        props = Object.assign({}, { context: { pageHref: window.location.href, pagePath: window.location.pathname, pageTitle: document.title.replace(/ - [^-]+/, '') } }, props)

        return new Promise((resolve, reject) => {
            if (!window.amplitude) {
                console.log(name, props)
                resolve()
            } else {
                window.amplitude.getInstance().logEvent(name, props, () => {
                    resolve()
                })
            }
        })
    }
}