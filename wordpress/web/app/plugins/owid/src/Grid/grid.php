<?php

namespace OWID\blocks\grid;

function render($attributes, $content)
{
    $block = <<<EOD
	<div class="wp-block-owid-grid">
		$content
	</div>
EOD;

    return $block;
}
