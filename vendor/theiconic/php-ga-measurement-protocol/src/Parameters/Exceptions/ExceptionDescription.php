<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Exceptions;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ExceptionDescription
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#exd
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Exceptions
 */
class ExceptionDescription extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'exd';
}
