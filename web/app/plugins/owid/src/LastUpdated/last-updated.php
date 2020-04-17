<?php

namespace OWID\blocks\last_updated;

function render($attributes, $content)
{
	$block = <<<EOD
	<div class="wp-block-last-updated">
		$content
	</div>
EOD;

	return $block;
}
