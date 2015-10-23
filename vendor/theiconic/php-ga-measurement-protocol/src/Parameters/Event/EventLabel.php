<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Event;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class EventLabel
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#el
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Event
 */
class EventLabel extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'el';
}
