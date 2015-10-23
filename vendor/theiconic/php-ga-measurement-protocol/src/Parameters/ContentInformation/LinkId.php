<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\ContentInformation;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class LinkId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#linkid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\ContentInformation
 */
class LinkId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'linkid';
}
