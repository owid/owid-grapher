import React from "react"
import { ExpandableParagraph } from "./ExpandableParagraph.js"

export default {
    title: "ExpandableParagraph",
    component: ExpandableParagraph,
}

export const Default = (): JSX.Element => (
    <>
        <h2>Usage with children</h2>
        <ExpandableParagraph>
            <>
                <p>
                    <strong>Boldem ipsum dolor sit amet</strong>,{" "}
                    <em>italicus adipiscing elit</em>. Vivamus quam enim,
                    porttitor in libero eu, imperdiet iaculis ante. Pellentesque
                    habitant morbi tristique senectus et netus et malesuada
                    fames ac turpis egestas. Morbi efficitur condimentum dictum.
                    Pellentesque at mauris eu augue gravida pretium sit amet in
                    quam. Vestibulum ut risus vel tellus commodo commodo id eu
                    orci. Vestibulum aliquet nisi gravida, consequat lectus sed,
                    efficitur elit. Nulla suscipit, diam in vehicula
                    sollicitudin, eros metus sollicitudin eros, ut faucibus quam
                    ante ultrices eros. Integer euismod lacus ex, mollis
                    tristique purus hendrerit ac. Aliquam ultrices orci a est
                    porta pulvinar. Pellentesque habitant morbi tristique
                    senectus et netus et malesuada fames ac turpis egestas.
                </p>
                <p>
                    Duis bibendum nisl et fermentum lacinia. Vestibulum eu
                    aliquet libero. Duis ut lorem ut quam dapibus scelerisque.
                    Sed commodo ultricies varius. Donec vel mattis tellus, sit
                    amet mattis sapien. Curabitur vel sem sit amet dolor
                    interdum pretium sit amet a nisl. In eu urna vel sem
                    sagittis porta. Curabitur eu sagittis augue. Nulla convallis
                    enim vel auctor rhoncus. Suspendisse non metus ut arcu
                    finibus dapibus. Fusce nec dignissim nisl. Duis hendrerit
                    sapien semper mattis aliquam.
                </p>
            </>
        </ExpandableParagraph>
        <h2>Usage with dangerouslySetInnerHTML</h2>
        <ExpandableParagraph
            dangerouslySetInnerHTML={{
                __html: `<p><strong>Boldem ipsum dolor sit amet</strong>, <em>italicus adipiscing elit</em>. Vivamus quam enim, porttitor in libero eu, imperdiet iaculis ante. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Morbi efficitur condimentum dictum. Pellentesque at mauris eu augue gravida pretium sit amet in quam. Vestibulum ut risus vel tellus commodo commodo id eu orci. Vestibulum aliquet nisi gravida, consequat lectus sed, efficitur elit. Nulla suscipit, diam in vehicula sollicitudin, eros metus sollicitudin eros, ut faucibus quam ante ultrices eros. Integer euismod lacus ex, mollis tristique purus hendrerit ac. Aliquam ultrices orci a est porta pulvinar. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.</p>\n<p>Duis bibendum nisl et fermentum lacinia. Vestibulum eu aliquet libero. Duis ut lorem ut quam dapibus scelerisque. Sed commodo ultricies varius. Donec vel mattis tellus, sit amet mattis sapien. Curabitur vel sem sit amet dolor interdum pretium sit amet a nisl. In eu urna vel sem sagittis porta. Curabitur eu sagittis augue. Nulla convallis enim vel auctor rhoncus. Suspendisse non metus ut arcu finibus dapibus. Fusce nec dignissim nisl. Duis hendrerit sapien semper mattis aliquam.</p>`,
            }}
        />
    </>
)
