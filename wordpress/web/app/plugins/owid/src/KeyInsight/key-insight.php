<?php

namespace OWID\blocks\key_insight;

function render($attributes, $content)
{
    $title = $attributes["title"] ?? "";
    $slug = $attributes["slug"] ?? "";

    $block = <<<EOD
	<block type="key-insight">
		<title>$title</title>
        <slug>$slug</slug>
        <content>$content</content>
	</block>
EOD;

    return $block;
}
