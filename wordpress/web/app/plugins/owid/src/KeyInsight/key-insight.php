<?php

namespace OWID\blocks\key_insight;

function render($attributes, $content)
{
    $block = <<<EOD
	<block type="key-insight">
		<content>$content</content>
	</block>
EOD;

    return $block;
}
