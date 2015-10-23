<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Timing;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class PageDownloadTime
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#pdt
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Timing
 */
class PageDownloadTime extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'pdt';
}
