<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Event;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class EventValue
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ev
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Event
 */
class EventValue extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ev';
}
