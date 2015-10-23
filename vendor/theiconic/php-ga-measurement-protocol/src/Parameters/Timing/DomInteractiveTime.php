<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class DomInteractiveTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#dit
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class DomInteractiveTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'dit';
}
