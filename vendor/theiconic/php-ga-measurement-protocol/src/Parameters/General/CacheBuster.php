<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\General;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class CacheBuster
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#z
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\General
 */
class CacheBuster extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'z';
}
