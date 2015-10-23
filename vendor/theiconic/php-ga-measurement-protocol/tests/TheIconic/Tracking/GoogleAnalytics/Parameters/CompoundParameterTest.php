<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters;

use TheIconic\Tracking\GoogleAnalytics\Tests\CompoundTestParameter;

class CompoundParameterTest extends \PHPUnit_Framework_TestCase
{
    /**
     * @var CompoundParameter
     */
    private $compoundParameter;

    public function setUp()
    {
        $this->compoundParameter = new CompoundTestParameter(['sku' => 5, 'name' => 'hello', 'dimension_3' => 'yep']);
    }

    public function testCompoundParameter()
    {
        $expect = [
            'id' => 5,
            'nm' => 'hello',
            'd3' => 'yep',
        ];

        $this->assertEquals($expect, $this->compoundParameter->getParameters());
    }

    /**
     * @expectedException \TheIconic\Tracking\GoogleAnalytics\Exception\InvalidCompoundParameterException
     */
    public function testRequiredCompundParameter()
    {
        (new CompoundTestParameter(['sku' => 5]));
    }

    /**
     * @expectedException \InvalidArgumentException
     */
    public function testInvalidDataCompundParameter()
    {
        (new CompoundTestParameter(['sku' => 5, 'name' => 'hello', 'dimensions_3' => 'yep']));
    }
}
