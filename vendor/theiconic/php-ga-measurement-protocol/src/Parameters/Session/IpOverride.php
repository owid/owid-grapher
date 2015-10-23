<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Session;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class IpOverride
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#uip
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Session
 */
class IpOverride extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'uip';
}
