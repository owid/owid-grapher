<?php

namespace OWID\blocks\help;

function render($attributes, $content)
{
	$block = <<<EOD
	<block type="help">
		<content>$content</content>
	</block>
EOD;

	return $block;
}
