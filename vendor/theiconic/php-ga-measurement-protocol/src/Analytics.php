<?php

namespace TheIconic\Tracking\GoogleAnalytics;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;
use TheIconic\Tracking\GoogleAnalytics\Parameters\CompoundParameterCollection;
use TheIconic\Tracking\GoogleAnalytics\Network\HttpClient;
use TheIconic\Tracking\GoogleAnalytics\Exception\InvalidPayloadDataException;
use Symfony\Component\Finder\Finder;

/**
 * Class Analytics
 *
 * The main interface for the clients, it relies heavily in magic methods exposing
 * an interface with method tags.
 *
 * General
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProtocolVersion($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setTrackingId($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setAnonymizeIp($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDataSource($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setQueueTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCacheBuster($value)
 *
 * User
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setClientId($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setUserId($value)
 *
 * Session
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setSessionControl($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setIpOverride($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setUserAgentOverride($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setGeographicalOverride($value)
 *
 * Traffic Sources
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDocumentReferrer($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCampaignName($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCampaignSource($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCampaignMedium($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCampaignKeyword($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCampaignContent($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCampaignId($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setGoogleAdwordsId($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setGoogleDisplayAdsId($value)
 *
 * System Info
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setScreenResolution($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setViewportSize($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDocumentEncoding($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setScreenColors($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setUserLanguage($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setJavaEnabled($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setFlashVersion($value)
 *
 * Hit
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setHitType($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setNonInteractionHit($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse sendPageview()
 * @method \TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse sendEvent()
 * @method \TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse sendScreenview()
 * @method \TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse sendTransaction()
 * @method \TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse sendItem()
 * @method \TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse sendSocial()
 * @method \TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse sendException()
 * @method \TheIconic\Tracking\GoogleAnalytics\AnalyticsResponse sendTiming()
 *
 * Content Information
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDocumentLocationUrl($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDocumentHostName($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDocumentPath($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDocumentTitle($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setScreenName($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setLinkId($value)
 *
 * App Tracking
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setApplicationName($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setApplicationId($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setApplicationVersion($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setApplicationInstallerId($value)
 *
 * Event Tracking
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setEventCategory($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setEventAction($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setEventLabel($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setEventValue($value)
 *
 * E-commerce
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setItemName($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setItemPrice($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setItemQuantity($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setItemCode($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setItemCategory($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCurrencyCode($value)
 *
 * Enhanced E-Commerce
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setTransactionId($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setAffiliation($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setRevenue($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setTax($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setShipping($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCouponCode($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionList($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCheckoutStep($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCheckoutStepOption($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics addProduct(array $productData)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductAction($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionToDetail()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionToClick()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionToAdd()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionToRemove()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionToCheckout()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionToCheckoutOption()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionToPurchase()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductActionToRefund()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setProductImpressionListName($value, $index)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics addProductImpression(array $productData, $index)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics addPromotion(array $promotionData)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setPromotionAction($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setPromotionActionToClick()
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setPromotionActionToView()
 *
 * Social Interactions
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setSocialNetwork($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setSocialAction($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setSocialActionTarget($value)
 *
 * Timing
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setUserTiminCategory($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setUserTimingVariableName($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setUserTimingTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setUserTimingLabel($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setPageLoadTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDnsTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setPageDownloadTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setRedirectResponseTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setTcpConnectTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setServerResponseTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setDomInteractiveTime($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setContentLoadTime($value)
 *
 * Exceptions
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setExceptionDescription($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setIsExceptionFatal($value)
 *
 * Custom Dimension / Metrics
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCustomDimension($value, $index)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setCustomMetric($value, $index)
 *
 * Content Grouping
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setContentGroup($value, $index)
 *
 * Content Experiments
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setExperimentId($value)
 * @method \TheIconic\Tracking\GoogleAnalytics\Analytics setExperimentVariant($value)
 *
 *
 * @package TheIconic\Tracking\GoogleAnalytics
 */
class Analytics
{
    /**
     * URI scheme for the GA API.
     *
     * @var string
     */
    private $uriScheme = 'http';

    /**
     * Indicates if the request to GA will be asynchronous (non-blocking).
     *
     * @var boolean
     */
    private $isAsyncRequest = false;

    /**
     * Endpoint to connect to when sending data to GA.
     *
     * @var string
     */
    private $endpoint = '://www.google-analytics.com/collect';

    /**
     * Holds the single parameters added to the hit.
     *
     * @var SingleParameter[]
     */
    private $singleParameters = [];

    /**
     * Holds the compound parameters collections added to the hit.
     *
     * @var  CompoundParameterCollection[]
     */
    private $compoundParametersCollections = [];

    /**
     * Initializes to a list of all the available parameters to be sent in a hit.
     *
     * @var array
     */
    private $availableParameters;

    /**
     * Holds the HTTP client used to connect to GA.
     *
     * @var HttpClient
     */
    private $httpClient;

    /**
     * When passed with an argument of TRUE, it will send the hit using HTTPS instead of plain HTTP.
     * It parses the available parameters.
     *
     * @param bool $isSsl
     * @throws \InvalidArgumentException
     */
    public function __construct($isSsl = false)
    {
        if (!is_bool($isSsl)) {
            throw new \InvalidArgumentException('First constructor argument "isSSL" must be boolean');
        }

        if ($isSsl) {
            $this->uriScheme .= 's';
            $this->endpoint = str_replace('www', 'ssl', $this->endpoint);
        }

        $this->availableParameters = $this->getAvailableParameters();
    }

    /**
     * Sets a request to be either synchronous or asynchronous (non-blocking).
     *
     * @param boolean $isAsyncRequest
     * @return $this
     */
    public function setAsyncRequest($isAsyncRequest)
    {
        $this->isAsyncRequest = $isAsyncRequest;

        return $this;
    }

    /**
     * Makes the request to GA asynchronous (non-blocking).
     *
     * @deprecated Use setAsyncRequest(boolean $isAsyncRequest) instead. To be removed in next major version.
     *
     * @return $this
     */
    public function makeNonBlocking()
    {
        $this->isAsyncRequest = true;

        return $this;
    }

    /**
     * Sets the HtppClient.
     *
     * @param HttpClient $httpClient
     * @return $this
     */
    public function setHttpClient(HttpClient $httpClient)
    {
        $this->httpClient = $httpClient;

        return $this;
    }

    /**
     * Gets the HttpClient.
     *
     * @return HttpClient
     */
    private function getHttpClient()
    {
        if ($this->httpClient === null) {
            // @codeCoverageIgnoreStart
            $this->setHttpClient(new HttpClient());
        }
        // @codeCoverageIgnoreEnd

        return $this->httpClient;
    }

    /**
     * Returns an array containing all the available parameters that can be sent in the hit.
     *
     * @return array
     */
    private function getAvailableParameters()
    {
        $parameterClassNames = [];

        $finder = new Finder();

        $finder->files()->in(__DIR__ . '/Parameters');

        foreach ($finder as $file) {
            $categorisedParameter = str_replace(
                ['.php', '/'],
                ['', '\\'],
                $file->getRelativePathname()
            );
            $categorisedParameterArray = explode('\\', $categorisedParameter);

            $validCategorisedParameterCount = 2;
            if (count($categorisedParameterArray) >= $validCategorisedParameterCount) {
                $parameterClassNames[$categorisedParameterArray[1]] = $categorisedParameter;
            }
        }

        return $parameterClassNames;
    }

    /**
     * Gets the full endpoint to GA.
     *
     * @return string
     */
    private function getEndpoint()
    {
        return $this->uriScheme . $this->endpoint;
    }

    /**
     * Sends a hit to GA. The hit will contain in the payload all the parameters added before.
     *
     * @param $methodName
     * @return AnalyticsResponse
     * @throws Exception\InvalidPayloadDataException
     */
    private function sendHit($methodName)
    {
        $hitType = strtoupper(substr($methodName, 4));

        $hitConstant = $this->getParameterClassConstant(
            'TheIconic\Tracking\GoogleAnalytics\Parameters\Hit\HitType::HIT_TYPE_' . $hitType,
            'Hit type ' . $hitType . ' is not defined, check spelling'
        );

        $this->setHitType($hitConstant);

        if (!$this->hasMinimumRequiredParameters()) {
            throw new InvalidPayloadDataException();
        }

        return $this->getHttpClient()->post(
            $this->getEndpoint(),
            $this->singleParameters,
            $this->compoundParametersCollections,
            $this->isAsyncRequest
        );
    }

    /**
     * Validates the minimum required parameters for every GA hit are being sent.
     *
     * @return bool
     */
    private function hasMinimumRequiredParameters()
    {
        $minimumRequiredParameters = [
            'v' => false,
            'tid' => false,
            'cid' => false,
            't' => false,
        ];

        foreach ($minimumRequiredParameters as $parameterName => $isParamPresent) {
            if (in_array($parameterName, array_keys($this->singleParameters))) {
                $minimumRequiredParameters[$parameterName] = true;
            }
        }

        return !in_array(false, $minimumRequiredParameters, true);
    }

    /**
     * Sets a parameter action to the value specified by the method call.
     *
     * @param $parameter
     * @param $action
     * @return $this
     */
    private function setParameterActionTo($parameter, $action)
    {
        $actionConstant = $this->getParameterClassConstant(
            'TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce\\'
            . $parameter . 'Action::ACTION_' . strtoupper($action),
            $parameter . ' action ' . $action . ' does not exist, check spelling'
        );

        $function = 'set' . $parameter . 'Action';

        $this->$function($actionConstant);

        return $this;
    }

    /**
     * Gets a contant from a class dynamically.
     *
     * @param $constant
     * @param $exceptionMsg
     * @return mixed
     * @throws \BadMethodCallException
     */
    private function getParameterClassConstant($constant, $exceptionMsg)
    {
        if (defined($constant)) {
            return constant($constant);
        } else {
            throw new \BadMethodCallException($exceptionMsg);
        }
    }

    /**
     * Sets the value for a parameter.
     *
     * @param $methodName
     * @param array $methodArguments
     * @return $this
     * @throws \InvalidArgumentException
     */
    private function setParameter($methodName, array $methodArguments)
    {
        $parameterClass = substr($methodName, 3);

        $fullParameterClass = $this->getFullParameterClass($parameterClass, $methodName);

        $parameterIndex = $this->getIndexFromArguments($methodArguments);

        /** @var SingleParameter $parameterObject */
        $parameterObject = new $fullParameterClass($parameterIndex);

        if (!isset($methodArguments[0])) {
            throw new \InvalidArgumentException(
                'For Analytics object, you must specify a value to be set for ' . $methodName
            );
        } else {
            $parameterObject->setValue($methodArguments[0]);
        }

        $this->singleParameters[$parameterObject->getName()] = $parameterObject;

        return $this;
    }

    /**
     * Adds an item to a compund parameter collection.
     *
     * @param $methodName
     * @param array $methodArguments
     * @return $this
     * @throws \InvalidArgumentException
     */
    private function addItem($methodName, array $methodArguments)
    {
        $parameterClass = substr($methodName, 3);

        $fullParameterClass = $this->getFullParameterClass($parameterClass, $methodName);

        if (!isset($methodArguments[0])) {
            throw new \InvalidArgumentException(
                'You must specify a ' . $parameterClass . ' to be add for ' . $methodName
            );
        } else {
            $parameterObject = new $fullParameterClass($methodArguments[0]);
        }

        $collectionIndex = $this->getIndexFromArguments($methodArguments);

        if (isset($this->compoundParametersCollections[$parameterClass . $collectionIndex])) {
            $this->compoundParametersCollections[$parameterClass . $collectionIndex]->add($parameterObject);
        } else {
            $fullParameterCollectionClass = $fullParameterClass . 'Collection';

            /** @var CompoundParameterCollection $parameterObjectCollection */
            $parameterObjectCollection = new $fullParameterCollectionClass($collectionIndex);

            $parameterObjectCollection->add($parameterObject);

            $this->compoundParametersCollections[$parameterClass . $collectionIndex] = $parameterObjectCollection;
        }

        return $this;
    }

    /**
     * Gets the index value from the arguments.
     *
     * @param $methodArguments
     * @return string
     */
    private function getIndexFromArguments($methodArguments)
    {
        $index = '';
        if (isset($methodArguments[1]) && is_numeric($methodArguments[1])) {
            $index = $methodArguments[1];
        }

        return $index;
    }

    /**
     * Gets the fully qualified name for a parameter.
     *
     * @param $parameterClass
     * @param $methodName
     * @return string
     * @throws \BadMethodCallException
     */
    private function getFullParameterClass($parameterClass, $methodName)
    {
        if (empty($this->availableParameters[$parameterClass])) {
            throw new \BadMethodCallException('Method ' . $methodName . ' not defined for Analytics class');
        } else {
            return '\\TheIconic\\Tracking\\GoogleAnalytics\\Parameters\\' . $this->availableParameters[$parameterClass];
        }
    }

    /**
     * Routes the method call to the adequate private method.
     *
     * @param $methodName
     * @param array $methodArguments
     * @return $this|AnalyticsResponse
     * @throws \BadMethodCallException
     */
    public function __call($methodName, array $methodArguments)
    {
        if (preg_match('/^set(Product|Promotion)ActionTo(\w+)/', $methodName, $matches)) {
            return $this->setParameterActionTo($matches[1], $matches[2]);
        }

        if (preg_match('/^(set)(\w+)/', $methodName, $matches)) {
            return $this->setParameter($methodName, $methodArguments);
        }

        if (preg_match('/^(add)(\w+)/', $methodName, $matches)) {
            return $this->addItem($methodName, $methodArguments);
        }

        if (preg_match('/^(send)(\w+)/', $methodName, $matches)) {
            return $this->sendHit($methodName);
        }

        throw new \BadMethodCallException('Method ' . $methodName . ' not defined for Analytics class');
    }
}
