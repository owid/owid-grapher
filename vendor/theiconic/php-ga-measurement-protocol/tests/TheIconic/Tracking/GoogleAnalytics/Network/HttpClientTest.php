<?php

namespace TheIconic\Tracking\GoogleAnalytics\Network;

use TheIconic\Tracking\GoogleAnalytics\Tests\CompoundParameterTestCollection;
use TheIconic\Tracking\GoogleAnalytics\Tests\CompoundTestParameter;
use TheIconic\Tracking\GoogleAnalytics\Tests\SingleTestParameter;
use TheIconic\Tracking\GoogleAnalytics\Tests\SingleTestParameterIndexed;

class HttpClientTest extends \PHPUnit_Framework_TestCase
{
    /**
     * @var HttpClient
     */
    private $httpClient;

    /**
     * @var HttpClient
     */
    private $mockHttpClient;

    public function setUp()
    {
        $this->httpClient = new HttpClient();

        $mockResponse = $this->getMockBuilder('GuzzleHttp\Psr7\Response')
            ->disableOriginalConstructor()
            ->getMock();

        $mockPromise = $this->getMockBuilder('GuzzleHttp\Promise\Promise')
            ->disableOriginalConstructor()
            ->getMock();

        $mockPromise->expects($this->exactly(3))
            ->method('wait')
            ->will($this->returnValue($mockResponse));


        $guzzleClient = $this->getMockBuilder('GuzzleHttp\Client')
            ->setMethods(['sendAsync'])
            ->disableOriginalConstructor()
            ->getMock();

        $guzzleClient->expects($this->atLeast(1))
            ->method('sendAsync')
            ->with($this->anything())
            ->will($this->returnValue($mockPromise));

        $this->httpClient->setClient($guzzleClient);


        $this->mockHttpClient = $this->getMockBuilder('TheIconic\Tracking\GoogleAnalytics\Network\HttpClient')
            ->setMethods(['getAnalyticsResponse'])
            ->getMock();

        $this->mockHttpClient->expects($this->atLeast(1))
            ->method('getAnalyticsResponse')
            ->will($this->returnArgument(1));

        $this->mockHttpClient->setClient($guzzleClient);
    }

    public function testPost()
    {
        $singleParameter = new SingleTestParameter();
        $singleParameter->setValue('hey');
        $singleParameterIdx = new SingleTestParameterIndexed(4);
        $singleParameterIdx->setValue(9);
        $singles = [$singleParameter, $singleParameterIdx];

        $compoundCollection = new CompoundParameterTestCollection(6);
        $compoundParameter = new CompoundTestParameter(['sku' => 555, 'name' => 'cathy']);
        $compoundCollection->add($compoundParameter);
        $compoundParameter2 = new CompoundTestParameter(['sku' => 666, 'name' => 'isa']);
        $compoundCollection->add($compoundParameter2);
        $compounds = [$compoundCollection];


        $response = $this->mockHttpClient->post('http://test-collector.com', $singles, $compounds);
        $this->assertInstanceOf('Psr\Http\Message\ResponseInterface', $response);

        $responseAsync = $this->mockHttpClient->post('http://test-collector.com', $singles, $compounds, true);
        $this->assertInstanceOf('GuzzleHttp\Promise\PromiseInterface', $responseAsync);


        $response = $this->httpClient->post('http://test-collector.com', $singles, $compounds);

        $this->assertInstanceOf('TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse', $response);

        $payload = $this->httpClient->getPayloadParameters();

        $expect = [
            'test' => 'hey',
            'testi4' => 9,
            'cp6t1id' => 555,
            'cp6t1nm' => 'cathy',
            'cp6t2id' => 666,
            'cp6t2nm' => 'isa',
        ];

        $this->assertEquals($expect, $payload);


        // Promises should be unwrapped on the object destruction
        $this->httpClient = null;
        $this->mockHttpClient = null;
    }
}
