<?php

namespace OWID\blocks\expandable_paragraph;

function render($attributes, $content)
{
    $block = <<<EOD
	<block type="expandable-paragraph">$content</block>
EOD;

    return $block;
}
