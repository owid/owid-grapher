<?php

namespace TheIconic\Tracking\GoogleAnalytics;

use GuzzleHttp\Message\RequestInterface;
use GuzzleHttp\Message\ResponseInterface;
use GuzzleHttp\Message\FutureResponse;

/**
 * Class AnalyticsResponse
 *
 * Represents the response got from GA.
 *
 * @package TheIconic\Tracking\GoogleAnalytics
 */
class AnalyticsResponse
{
    /**
     * HTTP status code for the response.
     *
     * @var null|int
     */
    protected $httpStatusCode;

    /**
     * Request URI that was used to send the hit.
     *
     * @var string
     */
    protected $requestUrl;

    /**
     * Gets the relevant data from the Guzzle clients.
     *
     * @param RequestInterface $request
     * @param ResponseInterface $response
     */
    public function __construct(RequestInterface $request, ResponseInterface $response)
    {
        if ($response instanceof FutureResponse) {
            $this->httpStatusCode = null;
        } else {
            $this->httpStatusCode = $response->getStatusCode();
        }

        $this->requestUrl = $request->getUrl();
    }

    /**
     * Gets the HTTP status code.
     * It return NULL if the request was asynchronous since we are not waiting for the response.
     *
     * @return null|int
     */
    public function getHttpStatusCode()
    {
        return $this->httpStatusCode;
    }

    /**
     * Gets the request URI used to get the response.
     *
     * @return string
     */
    public function getRequestUrl()
    {
        return $this->requestUrl;
    }
}
