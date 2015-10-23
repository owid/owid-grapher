<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Ecommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ItemCode
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ic
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Ecommerce
 */
class ItemCode extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ic';
}
