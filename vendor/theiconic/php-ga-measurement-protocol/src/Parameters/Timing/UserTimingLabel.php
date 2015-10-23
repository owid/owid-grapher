<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class UserTimingLabel
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#utl
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class UserTimingLabel extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'utl';
}
