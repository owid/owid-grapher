<?php

namespace TheIconic\Tracking\GoogleAnalytics\Tests;

use TheIconic\Tracking\GoogleAnalytics\Parameters\CompoundParameter;

class CompoundTestParameter extends CompoundParameter
{
    protected $parameterNameMapper = [
        '/^sku$/' => 'id',
        '/^name$/' => 'nm',
        '/^dimension_(\d{1,3})$/' => 'd',
    ];

    protected $requiredParameters = ['sku', 'name'];
}
