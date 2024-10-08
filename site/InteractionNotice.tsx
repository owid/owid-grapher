import React from "react"

// A modified FontAwesome icon. This is a string instead of JSX, so it can be
// also used outside of React when baking WordPress content.
export const INTERACTIVE_ICON_SVG = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="hand-pointer" class="svg-inline--fa fa-hand-pointer fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 617">
    <path fill="currentColor" d="M448,344.59v96a40.36,40.36,0,0,1-1.06,9.16l-32,136A40,40,0,0,1,376,616.59H168a40,40,0,0,1-32.35-16.47l-128-176a40,40,0,0,1,64.7-47.06L104,420.58v-276a40,40,0,0,1,80,0v200h8v-40a40,40,0,1,1,80,0v40h8v-24a40,40,0,1,1,80,0v24h8a40,40,0,1,1,80,0Zm-256,80h-8v96h8Zm88,0h-8v96h8Zm88,0h-8v96h8Z" transform="translate(0 -0.41)"/>
    <path fill="currentColor" opacity="0.6" d="M239.76,234.78A27.5,27.5,0,0,1,217,192a87.76,87.76,0,1,0-145.9,0A27.5,27.5,0,1,1,25.37,222.6,142.17,142.17,0,0,1,1.24,143.17C1.24,64.45,65.28.41,144,.41s142.76,64,142.76,142.76a142.17,142.17,0,0,1-24.13,79.43A27.47,27.47,0,0,1,239.76,234.78Z" transform="translate(0 -0.41)"/>
</svg>`

// shouldProgressiveEmbed is hardcoded to true, so this will only show if JS is disabled
export default function InteractionNotice() {
    return (
        <div className="interactionNotice">
            <span
                className="icon"
                dangerouslySetInnerHTML={{ __html: INTERACTIVE_ICON_SVG }}
            />
            <span className="label">Click to open interactive version</span>
        </div>
    )
}
