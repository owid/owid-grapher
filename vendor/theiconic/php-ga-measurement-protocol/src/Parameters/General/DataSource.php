<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\General;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class DataSource
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ds
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\General
 */
class DataSource extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ds';
}
