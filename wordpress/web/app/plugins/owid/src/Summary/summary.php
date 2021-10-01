<?php

namespace OWID\blocks\summary;

function render($attributes, $content)
{
    $block = <<<EOD
	<div class="wp-block-owid-summary">
		<h2>In this series</h2>
		$content
	</div>
EOD;

    return $block;
}
