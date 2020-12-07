<?php

namespace OWID\blocks\subtitle;

function render($attributes, $content)
{
    $block = <<<EOD
	<div class="wp-block-owid-subtitle">
		$content
	</div>
EOD;

    return $block;
}
