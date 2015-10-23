<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Event;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class EventAction
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ea
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Event
 */
class EventAction extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ea';
}
