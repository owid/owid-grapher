<?php

namespace OWID\blocks\additional_information;

function render($attributes, $content)
{
	$block = <<<EOD
	<block type="additional-information">
		<content>$content</content>
	</block>
EOD;

	return $block;
}
