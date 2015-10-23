<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\General;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class QueueTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#qt
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\General
 */
class QueueTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'qt';
}
