<?php

namespace OWID\blocks\prominent_link;

function render($attributes, $content)
{
    if (empty($attributes["linkUrl"])) {
        return;
    }

    $linkUrl = esc_url($attributes["linkUrl"]);
    $style = $attributes["className"] ? "style=\"$attributes[className]\"" : "";
    $title = $attributes["title"] ?? "";

    $image = null;
    if (!empty($attributes['mediaUrl'])) {
        $image = wp_get_attachment_image(
            $attributes['mediaId'],
            'medium_large'
        );
    }

    $block = <<<EOD
    <block type="prominent-link" $style>
        <link-url>$linkUrl</link-url>
        <title>$title</title>
        <content>$content</content>
        <figure>$image</figure>
    </block>
EOD;

    return $block;
}
