<?php

namespace OWID\blocks\technical_text;

function render($attributes, $content)
{
    $block = <<<EOD
	<div class="wp-block-owid-technical-text">
		$content
	</div>
EOD;

    return $block;
}
