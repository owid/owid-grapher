<?php

namespace TheIconic\Tracking\GoogleAnalytics;

use TheIconic\Tracking\GoogleAnalytics\Parameters\ContentGrouping\ContentGroup;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\Affiliation;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\CouponCode;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\Product;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\ProductAction;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\ProductCollection;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\Revenue;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\Shipping;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\Tax;
use TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\TransactionId;
use TheIconic\Tracking\GoogleAnalytics\Parameters\General\AnonymizeIp;
use TheIconic\Tracking\GoogleAnalytics\Parameters\General\CacheBuster;
use TheIconic\Tracking\GoogleAnalytics\Parameters\General\DataSource;
use TheIconic\Tracking\GoogleAnalytics\Parameters\General\ProtocolVersion;
use TheIconic\Tracking\GoogleAnalytics\Parameters\General\QueueTime;
use TheIconic\Tracking\GoogleAnalytics\Parameters\General\TrackingId;
use TheIconic\Tracking\GoogleAnalytics\Parameters\Hit\NonInteractionHit;
use TheIconic\Tracking\GoogleAnalytics\Parameters\Session\IpOverride;
use TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources\GoogleDisplayAdsId;
use TheIconic\Tracking\GoogleAnalytics\Parameters\User\ClientId;
use TheIconic\Tracking\GoogleAnalytics\Parameters\Hit\HitType;

/**
 * Class AnalyticsTest
 * @package TheIconic\Tracking\GoogleAnalytics
 */
class AnalyticsTest extends \PHPUnit_Framework_TestCase
{
    /**
     * @var Analytics
     */
    private $analytics;

    /**
     * @var Analytics
     */
    private $analyticsSsl;


    public function setUp()
    {
        $this->analytics = new Analytics();
        $this->analyticsSsl = new Analytics(true);
    }

    /**
     * @expectedException \InvalidArgumentException
     */
    public function testInvalidClassInitialization()
    {
        (new Analytics('1'));
    }

    public function testHttpsEndpoint()
    {
        $sslAnalytics = new Analytics(true);
        $this->assertInstanceOf('TheIconic\Tracking\GoogleAnalytics\Analytics', $sslAnalytics);
    }

    public function testSetParameter()
    {
        $response = $this->analytics
            ->setProtocolVersion('1')
            ->setTrackingId('UA-26293424-11')
            ->setClientId('555')
            ->setDocumentPath('/');

        $this->assertInstanceOf('TheIconic\Tracking\GoogleAnalytics\Analytics', $response);
    }

    public function testSetIndexedParameter()
    {
        $response = $this->analytics
            ->setProtocolVersion('1')
            ->setTrackingId('UA-26563724-11')
            ->setClientId('555')
            ->setDocumentPath('/')
            ->setProductImpressionListName('list name', 1);

        $this->assertInstanceOf('TheIconic\Tracking\GoogleAnalytics\Analytics', $response);
    }

    /**
     * @expectedException \InvalidArgumentException
     */
    public function testSetInvalidParameterValue()
    {
        $this->analytics
            ->setProtocolVersion();
    }

    /**
     * @expectedException \BadMethodCallException
     */
    public function testSetInvalidParameter()
    {
        $this->analytics
            ->setNonExistant('1');
    }

    public function testAddItem()
    {
        $productData = [
            'sku' => 'AAAA-6666',
            'name' => 'Test Product 2',
            'brand' => 'Test Brand 2',
            'category' => 'Test Category 3/Test Category 4',
            'variant' => 'yellow',
            'price' => 50.00,
            'quantity' => 1,
            'coupon_code' => 'TEST 2',
            'position' => 2
        ];

        $this->analytics->addProduct($productData);

        $productData = [
            'sku' => 'AAAA-5555',
            'name' => 'Test Product',
            'brand' => 'Test Brand',
            'category' => 'Test Category 1/Test Category 2',
            'variant' => 'blue',
            'price' => 85.00,
            'quantity' => 2,
            'coupon_code' => 'TEST',
            'position' => 4
        ];

        $response = $this->analytics->addProduct($productData);

        $this->assertInstanceOf('TheIconic\Tracking\GoogleAnalytics\Analytics', $response);
    }

    /**
     * @expectedException \BadMethodCallException
     */
    public function testAddNonExistant()
    {
        $this->analytics
            ->addNonExistant('1');
    }

    /**
     * @expectedException \InvalidArgumentException
     */
    public function testSetInvalidAddValue()
    {
        $this->analytics
            ->addProduct();
    }

    public function testSetProductAction()
    {
        $this->analytics->setProductActionToCheckout();
        $this->analytics->setProductActionToCheckoutOption();
        $this->analytics->setProductActionToPurchase();
        $this->analytics->setProductActionToAdd();
        $this->analytics->setProductActionToClick();
        $this->analytics->setProductActionToDetail();
        $this->analytics->setProductActionToRefund();
        $this->analytics->setProductActionToRemove();
    }

    public function testSetPromotionAction()
    {
        $this->analytics->setPromotionActionToClick();
        $this->analytics->setPromotionActionToView();
    }

    /**
     * @expectedException \BadMethodCallException
     */
    public function testSetInvalidProductAction()
    {
        $this->analytics->setProductActionToPurchae();
    }

    public function testSendSimpleHit()
    {
        $httpClient = $this->getMock('TheIconic\Tracking\GoogleAnalytics\Network\HttpClient', ['post']);

        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                $this->equalTo('http://www.google-analytics.com/collect'),
                $this->isType('array'),
                $this->isType('array')
            );

        $this->analytics
            ->setProtocolVersion('1')
            ->setTrackingId('555')
            ->setClientId('666')
            ->setDocumentPath('\thepage');

        $this->analytics->setHttpClient($httpClient);

        $this->analytics->sendPageview();
    }

    public function testSendSimpleSslHit()
    {
        $httpClient = $this->getMock('TheIconic\Tracking\GoogleAnalytics\Network\HttpClient', ['post']);

        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                $this->equalTo('https://ssl.google-analytics.com/collect'),
                $this->isType('array'),
                $this->isType('array')
            );

        $this->analyticsSsl
            ->setAsyncRequest(true)
            ->setProtocolVersion('1')
            ->setTrackingId('555')
            ->setClientId('666')
            ->setDocumentPath('\mypage');

        $this->analyticsSsl->setHttpClient($httpClient);

        $this->analyticsSsl->sendPageview();
    }

    public function testSendComplexHit()
    {
        $singleParameters = [
            'v' => (new ProtocolVersion())->setValue('1'),
            'tid' => (new TrackingId())->setValue('555'),
            'cid' => (new ClientId())->setValue('666'),
            't' => (new HitType())->setValue('pageview'),
        ];

        $httpClient = $this->getMock('TheIconic\Tracking\GoogleAnalytics\Network\HttpClient', ['post']);

        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                $this->equalTo('http://www.google-analytics.com/collect'),
                $this->equalTo($singleParameters),
                $this->isType('array')
            );

        $this->analytics
            ->makeNonBlocking()
            ->setProtocolVersion('1')
            ->setTrackingId('555')
            ->setClientId('666');

        $this->analytics->setHttpClient($httpClient);

        $this->analytics->sendPageview();
    }

    public function testContentGroupingHit()
    {
        $singleParameters = [
            'v' => (new ProtocolVersion())->setValue('1'),
            'tid' => (new TrackingId())->setValue('555'),
            'cid' => (new ClientId())->setValue('666'),
            't' => (new HitType())->setValue('pageview'),
            'cg1' => (new ContentGroup(1))->setValue('group'),
        ];

        $httpClient = $this->getMock('TheIconic\Tracking\GoogleAnalytics\Network\HttpClient', ['post']);

        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                $this->equalTo('http://www.google-analytics.com/collect'),
                $this->equalTo($singleParameters),
                $this->isType('array')
            );

        $this->analytics
            ->makeNonBlocking()
            ->setProtocolVersion('1')
            ->setTrackingId('555')
            ->setClientId('666')
            ->setContentGroup('group', 1);

        $this->analytics->setHttpClient($httpClient);

        $this->analytics->sendPageview();
    }

    /**
     * @expectedException \TheIconic\Tracking\GoogleAnalytics\Exception\InvalidIndexException
     */
    public function testInvalidContentGroupIndex()
    {
        $this->analytics
            ->setContentGroup('group', 6);
    }

    public function testSendMegaHit()
    {
        $singleParameters = [
            'v' => (new ProtocolVersion())->setValue('1'),
            'tid' => (new TrackingId())->setValue('555'),
            'cid' => (new ClientId())->setValue('666'),
            't' => (new HitType())->setValue('event'),
            'aip' => (new AnonymizeIp())->setValue('1'),
            'z' => (new CacheBuster())->setValue('289372387623'),
            'ds' => (new DataSource())->setValue('call center'),
            'qt' => (new QueueTime())->setValue('560'),
            'ni' => (new NonInteractionHit())->setValue('1'),
            'dclid' => (new GoogleDisplayAdsId())->setValue('d_click_id'),
            'uip' => (new IpOverride())->setValue('202.126.106.175'),
            'ti' => (new TransactionId())->setValue('7778922'),
            'ta' => (new Affiliation())->setValue('THE ICONIC'),
            'tr' => (new Revenue())->setValue(250),
            'tt' => (new Tax())->setValue(25),
            'ts' => (new Shipping())->setValue(15),
            'tcc' => (new CouponCode())->setValue('MY_COUPON'),
            'pa' => (new ProductAction())->setValue('purchase')
        ];

        $this->analytics
            ->setAsyncRequest(true)
            ->setProtocolVersion('1')
            ->setTrackingId('555')
            ->setClientId('666')
            ->setAnonymizeIp('1')
            ->setCacheBuster('289372387623')
            ->setDataSource('call center')
            ->setQueueTime('560')
            ->setNonInteractionHit('1')
            ->setGoogleDisplayAdsId('d_click_id')
            ->setIpOverride("202.126.106.175");

        $this->analytics->setTransactionId('7778922')
            ->setAffiliation('THE ICONIC')
            ->setRevenue(250.0)
            ->setTax(25.0)
            ->setShipping(15.0)
            ->setCouponCode('MY_COUPON');


        $productData1 = [
            'sku' => 'AAAA-6666',
            'name' => 'Test Product 2',
            'brand' => 'Test Brand 2',
            'category' => 'Test Category 3/Test Category 4',
            'variant' => 'yellow',
            'price' => 50.00,
            'quantity' => 1,
            'coupon_code' => 'TEST 2',
            'position' => 2
        ];

        $this->analytics->addProduct($productData1);

        $productData2 = [
            'sku' => 'AAAA-5555',
            'name' => 'Test Product',
            'brand' => 'Test Brand',
            'category' => 'Test Category 1/Test Category 2',
            'variant' => 'blue',
            'price' => 85.00,
            'quantity' => 2,
            'coupon_code' => 'TEST',
            'position' => 4
        ];

        $this->analytics->addProduct($productData2);

        $products = new ProductCollection();
        $products->add(new Product($productData1));
        $products->add(new Product($productData2));

        $compoundParameters = [
            'Product' => $products,
        ];

        $this->analytics->setProductActionToPurchase();

        $httpClient = $this->getMock('TheIconic\Tracking\GoogleAnalytics\Network\HttpClient', ['post']);

        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                $this->equalTo('http://www.google-analytics.com/collect'),
                $this->equalTo($singleParameters),
                $this->equalTo($compoundParameters)
            );

        $this->analytics->setHttpClient($httpClient);

        $this->analytics->sendEvent();
    }

    /**
     * @expectedException \TheIconic\Tracking\GoogleAnalytics\Exception\InvalidPayloadDataException
     */
    public function testMinimumParametersForSendHit()
    {
        $this->analytics->sendPageview();
    }

    /**
     * @expectedException \BadMethodCallException
     */
    public function testSetInvalidSendHit()
    {
        $this->analytics->sendPageviw();
    }

    /**
     * @expectedException \BadMethodCallException
     */
    public function testInvalidMethodCall()
    {
        $this->analytics
            ->iDontExists();
    }
}
