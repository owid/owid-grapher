<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\General;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class AnonymizeIp
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#aip
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\General
 */
class AnonymizeIp extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'aip';
}
