<?php

namespace OWID\blocks\code_snippet;

function render($attributes, $content)
{
    $block = <<<EOD
	<div class="wp-code-snippet">$content</div>
EOD;

    return $block;
}
