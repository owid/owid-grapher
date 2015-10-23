<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\General;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class TrackingId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#tid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\General
 */
class TrackingId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'tid';
}
