<?php

namespace OWID\blocks\key_insights_slider;

function render($attributes, $content)
{
    $title = $attributes["title"] ?? "";
    $slug = $attributes["slug"] ?? "";

    $block = <<<EOD
	<block type="key-insights">
		<title>$title</title>
        <slug>$slug</slug>
        <insights>$content</insights>
	</block>
EOD;

    return $block;
}
