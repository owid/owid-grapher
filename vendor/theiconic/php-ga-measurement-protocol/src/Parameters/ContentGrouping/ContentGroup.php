<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\ContentGrouping;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ContentGroup
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cg_
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\ContentGroup
 */
class ContentGroup extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'cg:i:';

    /**
     * @inheritDoc
     *
     * @return int
     */
    protected function maxIndex()
    {
        return 5;
    }
}
