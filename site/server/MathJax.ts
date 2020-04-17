import { mathjax } from "mathjax-full/js/mathjax"
import { TeX } from "mathjax-full/js/input/tex"
import { SVG } from "mathjax-full/js/output/svg"
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor"
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html"
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages"

export function initMathJax() {
    const adaptor = liteAdaptor()
    RegisterHTMLHandler(adaptor)

    const tex = new TeX({ packages: AllPackages })
    const svg = new SVG({ fontCache: "local" })
    const doc = mathjax.document("", {
        InputJax: tex,
        OutputJax: svg
    })

    return function format(latex: string): string {
        const node = doc.convert(latex, {
            display: true
        })
        return adaptor.outerHTML(node) // as HTML
    }
}
