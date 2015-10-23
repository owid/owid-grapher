<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ContentLoadTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#clt
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class ContentLoadTime extends SingleParameter
{
    /**
     * @var string
     */
    protected $name = 'clt';
}
