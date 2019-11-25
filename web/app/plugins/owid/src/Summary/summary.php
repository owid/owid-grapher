<?php
namespace OWID\blocks\summary;

function render($attributes, $content)
{
	$block = <<<EOD
	<block type="owid-summary">
		<attributes>
			<title>Summary</title>
		</attributes>
		<content>$content</content>
	</block>
EOD;

	return $block;
}