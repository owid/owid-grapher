<?php

namespace OWID\blocks\all_charts;

function render($attributes, $content)
{
    $block = <<<EOD
	<block type="all-charts">$content</block>
EOD;

    return $block;
}
