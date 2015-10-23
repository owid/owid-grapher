<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class RedirectResponseTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#rrt
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class RedirectResponseTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'rrt';
}
