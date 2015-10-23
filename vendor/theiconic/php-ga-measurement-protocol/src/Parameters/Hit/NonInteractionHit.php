<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Hit;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class NonInteractionHit
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ni
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Hit
 */
class NonInteractionHit extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ni';
}
