<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Event;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class EventCategory
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ec
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Event
 */
class EventCategory extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ec';
}
