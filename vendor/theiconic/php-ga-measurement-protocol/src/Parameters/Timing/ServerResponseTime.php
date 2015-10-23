<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ServerResponseTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#srt
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class ServerResponseTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'srt';
}
