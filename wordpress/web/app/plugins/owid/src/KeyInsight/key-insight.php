<?php

namespace OWID\blocks\key_insight;

function render($attributes, $content)
{
    $title = $attributes["title"] ?? "";
    $slug = $attributes["slug"] ?? "";
    $is_title_hidden = $attributes["isTitleHidden"] ?? 0;

    $block = <<<EOD
	<block type="key-insight">
		<title is-hidden="$is_title_hidden">$title</title>
        <slug>$slug</slug>
        <content>$content</content>
	</block>
EOD;

    return $block;
}
