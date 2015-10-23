<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class PageLoadTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#plt
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class PageLoadTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'plt';
}
