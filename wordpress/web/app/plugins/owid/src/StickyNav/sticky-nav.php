<?php

namespace OWID\blocks\sticky_nav;

function render($attributes, $content)
{
    $block = <<<EOD
	<div class="sticky-nav-contents">$content</div>
EOD;

    return $block;
}
