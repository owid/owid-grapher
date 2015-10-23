<?php

namespace TheIconic\Tracking\GoogleAnalytics;

use GuzzleHttp\Psr7\Uri;
use Psr\Http\Message\RequestInterface;

class AnalyticsResponseTest extends \PHPUnit_Framework_TestCase
{
    /**
     * @var AnalyticsResponse
     */
    private $analyticsResponse;

    /**
     * @var AnalyticsResponse
     */
    private $analyticsResponseAsync;

    /**
     * @var RequestInterface
     */
    private $mockRequest;

    public function setUp()
    {
        $mockResponse = $this->getMockBuilder('GuzzleHttp\Psr7\Response')
            ->setMethods(['getStatusCode'])
            ->disableOriginalConstructor()
            ->getMock();

        $mockResponse->expects($this->atLeast(1))
            ->method('getStatusCode')
            ->will($this->returnValue('200'));

        $this->mockRequest = $this->getMockBuilder('GuzzleHttp\Psr7\Request')
            ->setMethods(['getUri'])
            ->disableOriginalConstructor()
            ->getMock();

        $this->mockRequest->expects($this->atLeast(1))
            ->method('getUri')
            ->will($this->returnValue(new Uri('http://test-collector/hello')));

        $this->analyticsResponse = new AnalyticsResponse($this->mockRequest, $mockResponse);

        $mockResponseAsync = $this->getMockBuilder('GuzzleHttp\Promise\Promise')
            ->disableOriginalConstructor()
            ->getMock();

        $this->analyticsResponseAsync = new AnalyticsResponse($this->mockRequest, $mockResponseAsync);
    }

    /**
     * @expectedException \InvalidArgumentException
     */
    public function testConstructorWithWrongResponseValue()
    {
        new AnalyticsResponse($this->mockRequest, new \stdClass());
    }

    public function testStatusCode()
    {
        $this->assertEquals('200', $this->analyticsResponse->getHttpStatusCode());
        $this->assertEquals(null, $this->analyticsResponseAsync->getHttpStatusCode());
    }

    public function testGetUrl()
    {
        $this->assertEquals('http://test-collector/hello', $this->analyticsResponse->getRequestUrl());
        $this->assertEquals('http://test-collector/hello', $this->analyticsResponseAsync->getRequestUrl());
    }
}
