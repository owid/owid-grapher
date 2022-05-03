<?php

namespace OWID\blocks\technical_text;

function render($attributes, $content)
{
    $block = <<<EOD
	<div class="technical-text">
		$content
	</div>
EOD;

    return $block;
}
