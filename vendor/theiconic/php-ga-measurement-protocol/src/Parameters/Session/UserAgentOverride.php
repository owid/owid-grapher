<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Session;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class UserAgentOverride
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ua
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Session
 */
class UserAgentOverride extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ua';
}
