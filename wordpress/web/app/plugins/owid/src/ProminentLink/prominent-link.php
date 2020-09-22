<?php

namespace OWID\blocks\prominent_link;

const STYLE_DEFAULT = "is-style-default";
const STYLE_THIN = "is-style-thin";

function render($attributes, $content)
{
    $style = !empty($attributes['className'])
        ? $attributes['className']
        : STYLE_DEFAULT;
    $classes = 'wp-block-owid-prominent-link ' . $style;

    $title = null;
    if (!empty($attributes['title'])) {
        $title_tag = 'h3';
        if ($style === STYLE_THIN) {
            $title_tag = 'div class="title"';
        }
        $title =
            "<{$title_tag}>{$attributes['title']}" .
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z"/></svg>' .
            "</{$title_tag}>";
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

    $block = null;
    if ($style === STYLE_THIN) {
        $block = <<<EOD
      <div class="$classes">
        $linkStart
          $figure
          <div class="content-wrapper">
            <div class="content">
              $content
            </div>
            $title
          </div>
        $linkEnd
      </div>
EOD;
    } else {
        $block = <<<EOD
      <div class="$classes">
        $linkStart
          $title
          <div class="content-wrapper">
            $figure
            <div class="content">
              $content
            </div>
          </div>
        $linkEnd
      </div>
EOD;
    }

    return $block;
}
