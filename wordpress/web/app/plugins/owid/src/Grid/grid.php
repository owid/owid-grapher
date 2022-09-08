<?php

namespace OWID\blocks\grid;

function render($block, $content)
{
    $classes = $block["className"];
    $block = <<<EOD
	<div class="wp-block-owid-grid $classes">
		$content
	</div>
EOD;

    return $block;
}
