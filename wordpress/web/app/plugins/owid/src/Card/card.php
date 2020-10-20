<?php

namespace OWID\blocks\card;

function render($attributes, $content)
{
    $classes = 'wp-block-owid-card ';

    $title = null;
    if (!empty($attributes['title'])) {
        $title =
            "<div class=\"title\">{$attributes['title']}" .
            "</div class=\"title\">";
    }

    $linkStart = $linkEnd = null;
    $isGrapher = null;
    if (!empty($attributes['linkUrl'])) {
        $isGrapher =
            substr(parse_url($attributes['linkUrl'], PHP_URL_PATH), 0, 9) ===
            '/grapher/';
        $target_blank = $isGrapher ? ' target="_blank"' : null;
        $linkStart =
            '<a href="' .
            esc_url($attributes['linkUrl']) .
            '"' .
            $target_blank .
            '>';
        $linkEnd = '</a>';
    }

    $img = null;
    if (!empty($attributes['mediaUrl'])) {
        $img = wp_get_attachment_image($attributes['mediaId'], 'medium_large');
    } else {
        if ($isGrapher) {
            $pathElements = explode(
                "/",
                parse_url($attributes['linkUrl'], PHP_URL_PATH)
            );
            $chartSlug = end($pathElements);
            $img = '<img src="/grapher/exports/' . $chartSlug . '.svg" />';
        }
    }

    $figure = null;
    if ($img) {
        $figure = "<figure>" . $img . "</figure>";
        $classes .= ' with-image';
    }

    $block = <<<EOD
      <div class="$classes">
        $linkStart
          <div class="content-wrapper">
            $figure
            <div class="content">
              $title
              $content
            </div>
          </div>
        $linkEnd
      </div>
EOD;

    return $block;
}
