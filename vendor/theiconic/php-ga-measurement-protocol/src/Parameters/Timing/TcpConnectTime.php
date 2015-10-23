<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class TcpConnectTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#tcp
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class TcpConnectTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'tcp';
}
