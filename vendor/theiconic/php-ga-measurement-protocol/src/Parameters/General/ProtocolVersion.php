<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\General;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ProtocolVersion
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#v
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\General
 */
class ProtocolVersion extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'v';
}
