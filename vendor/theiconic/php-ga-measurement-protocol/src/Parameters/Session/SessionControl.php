<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Session;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class SessionControl
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#sc
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Session
 */
class SessionControl extends SingleParameter
{
    /**
     * Forces a new session to start.
     */
    const SESSION_CONTROL_START = 'start';

    /**
     * Forces the current session to end.
     */
    const SESSION_CONTROL_END = 'end';

    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'sc';
}
