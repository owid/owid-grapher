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

    public function setUp()
    {
        $this->httpClient = new HttpClient();

        $guzzleClient = $this->getMockBuilder('GuzzleHttp\Client')
            ->setMethods(['createRequest', 'send'])
            ->disableOriginalConstructor()
            ->getMock();

        $mockRequest = $this->getMockBuilder('GuzzleHttp\Message\Request')
            ->disableOriginalConstructor()
            ->getMock();

        $guzzleClient->expects($this->atLeast(1))
            ->method('createRequest')
            ->with($this->equalTo('GET'), $this->equalTo('http://test-collector.com'), $this->anything())
            ->will($this->returnValue($mockRequest));

        $mockResponse = $this->getMockBuilder('GuzzleHttp\Message\Response')
            ->disableOriginalConstructor()
            ->getMock();

        $guzzleClient->expects($this->atLeast(1))
            ->method('send')
            ->with($this->anything())
            ->will($this->returnValue($mockResponse));

        $this->httpClient->setClient($guzzleClient);
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
    }
}
