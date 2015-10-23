<?php

namespace TheIconic\Tracking\GoogleAnalytics;

use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use GuzzleHttp\Promise\PromiseInterface;

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
     * @param ResponseInterface|PromiseInterface $response
     */
    public function __construct(RequestInterface $request, $response)
    {
        if ($response instanceof ResponseInterface) {
            $this->httpStatusCode = $response->getStatusCode();
        } elseif ($response instanceof PromiseInterface) {
            $this->httpStatusCode = null;
        } else {
            throw new \InvalidArgumentException(
                'Second constructor argument "response" must be instance of ResponseInterface or PromiseInterface'
            );
        }

        $this->requestUrl = (string)$request->getUri();
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
