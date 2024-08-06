import React from "react"

/**
 * For more details about these components, see `browser-support.md`.
 */

// Detect if JavaScript is enabled and set a class on the HTML element.
// Also detect if the browser doesn't support `<script type="module">`, or if there's a parsing error
// happening in old browsers because "relatively new" syntax is being used.
// Sets the `js-enabled` class if JavaScript is enabled, and `js-disabled` if not or if an error ocurred.
export const NoJSDetector = ({ baseUrl }: { baseUrl: string }) => (
    <script
        dangerouslySetInnerHTML={{
            __html: `
function setJSEnabled(enabled) {
    var elem = window.document.documentElement;
    if (enabled) {
        elem.classList.remove("js-disabled");
        elem.classList.add("js-enabled");
    } else {
        elem.classList.remove("js-enabled");
        elem.classList.add("js-disabled");
    }
}
if ("noModule" in HTMLScriptElement.prototype) {
    setJSEnabled(true);
} else {
    setJSEnabled(false);
}
window.onerror = function (err, url) {
    var isOurSyntaxError = typeof err === "string" && err.indexOf("SyntaxError") > -1 && url.indexOf("${baseUrl}") > -1;
    if (isOurSyntaxError) {
        console.error("Caught global syntax error", err, url);
        setJSEnabled(false);
    }
}`,
        }}
    ></script>
)

// Attaches `onerror` event listeners to all scripts with a `data-attach-owid-error-handler` attribute.
// If they fail to load, it will set the `js-disabled` class on the HTML element.
export const ScriptLoadErrorDetector = () => (
    <script
        dangerouslySetInnerHTML={{
            __html: `
document.querySelectorAll("script[data-attach-owid-error-handler]").forEach(script => {
    script.onerror = () => {
        console.log(new Error("Failed to load script: ", script.src));
        document.documentElement.classList.add("js-disabled");
        document.documentElement.classList.remove("js-enabled");
    }
})`,
        }}
    />
)
