<?php

namespace OWID\blocks\citation_snippet;

function render($attributes, $content)
{
    $block = <<<EOD
	<div class="wp-citation-snippet">$content</div>
EOD;

    return $block;
}
