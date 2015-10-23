<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class DnsTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#dns
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class DnsTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'dns';
}
