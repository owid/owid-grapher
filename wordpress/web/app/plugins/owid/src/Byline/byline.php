<?php

namespace OWID\blocks\byline;

function render($attributes, $content)
{
	$block = <<<EOD
	<div class="wp-block-owid-byline">
		$content
	</div>
EOD;

	return $block;
}
