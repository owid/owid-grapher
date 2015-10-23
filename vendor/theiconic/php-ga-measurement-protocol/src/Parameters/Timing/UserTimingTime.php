<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class UserTimingTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#utt
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class UserTimingTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'utt';
}
