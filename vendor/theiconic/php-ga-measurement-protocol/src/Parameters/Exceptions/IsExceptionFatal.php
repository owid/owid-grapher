<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Exceptions;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class IsExceptionFatal
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#exf
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Exceptions
 */
class IsExceptionFatal extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'exf';
}
