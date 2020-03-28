import * as CSS from "csstype"
import * as React from "react"

export interface CssMap {
    [cssSelector: string]: CSS.Properties
}

export class StyleBlock {
    private map: CssMap
    constructor(map: CssMap) {
        this.map = map
    }

    toElement() {
        const style = Object.keys(this.map)
            .map(selector => {
                const values = this.map[selector] as any
                const props = Object.keys(values)
                    .map((propName: string) => {
                        const value = values[propName]
                        return `${propName.replace(
                            /([A-Z])/g,
                            (letter: string) => `-${letter.toLowerCase()}`
                        )} : ${value};`
                    })
                    .join("\n")

                return `${selector} {
                ${props}
            }`
            })
            .join("\n")
        return <style dangerouslySetInnerHTML={{ __html: style }} />
    }
}
