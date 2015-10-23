<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\ContentInformation;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ScreenName
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cd
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\ContentInformation
 */
class ScreenName extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'cd';
}
