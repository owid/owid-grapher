export const bakeEmbedSnippet = (
    commonsCssLink: string,
    commonsJsLink: string,
    owidJsLink: string
) => `const embedSnippet = () => {
const link = document.createElement('link')
link.type = 'text/css'
link.rel = 'stylesheet'
link.href = '${commonsCssLink}'
document.head.appendChild(link)

let loadedScripts = 0;
const checkReady = () => {
    loadedScripts++
    if (loadedScripts === 3)
        window.MultiEmbedderSingleton.embedAll()
}

const coreScripts = ['https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch', '${commonsJsLink}', '${owidJsLink}']

coreScripts.forEach(url => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.onload = checkReady
    script.src = url
    document.head.appendChild(script)
})
}
embedSnippet()
`
