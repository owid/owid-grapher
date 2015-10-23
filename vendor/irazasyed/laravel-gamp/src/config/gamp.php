<?php

/**
 * Laravel GAMP: Google Analytics - Measurement Protocol.
 *
 * NOTICE OF LICENSE
 *
 * Licensed under the MIT License.
 *
 * This source file is subject to the MIT  License that is
 * bundled with this package in the LICENSE file.  It is also available at
 * the following URL: http://opensource.org/licenses/MIT
 *
 * @author        Lukonet
 * @license       MIT
 * @copyright (c) 2015 Lukonet Pvt. Ltd.
 *
 * @link          https://lukonet.com
 */

return [
    /*
    |--------------------------------------------------------------------------
    | Google Analytics Tracking / Web Property ID [REQUIRED]
    |--------------------------------------------------------------------------
    |
    | Your Google Analytics tracking ID / web property ID. The format is UA-XXXX-Y.
    | All collected data is associated by this ID.
    |
    | Refer:
    | https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#tid
    |
    */
    'tracking_id' => 'UA-XXXX-Y',

    /*
    |--------------------------------------------------------------------------
    | Measurement Protocol Version [REQUIRED]
    |--------------------------------------------------------------------------
    |
    | The Protocol version. The current value is '1'.
    | This will only change when there are changes made that are not backwards compatible.
    |
    | Refer:
    | https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#v
    |
    | Default: 1
    |
    */
    'protocol_version' => 1,

    /*
    |--------------------------------------------------------------------------
    | URL Endpoint - SSL Support: Send Data over SSL [Optional]
    |--------------------------------------------------------------------------
    |
    | This option controls the URL endpoint of the Measurement Protocol.
    | To send data over SSL, set true.
    |
    | Refer:
    | https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#tid
    |
    | Default: false
    | Valid Values: (Boolean) "true" OR "false"
    |
    */
    'is_ssl' => false,

    /*
    |--------------------------------------------------------------------------
    | Anonymize IP [Optional]
    |--------------------------------------------------------------------------
    |
    | When set to True, the IP address of the sender will be anonymized.
    |
    | Refer:
    | https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#aip
    |
    | Default: false
    | Valid Values: (Boolean) "true" OR "false"
    |
    */
    'anonymize_ip' => false,

    /*
    |--------------------------------------------------------------------------
    | Asynchronous Requests [Optional]
    |--------------------------------------------------------------------------
    |
    | When set to True, All the requests would be made non-blocking (Async).
    |
    | Default: false
    | Valid Values: (Boolean) "true" OR "false"
    |
    */
    'async_requests' => false,
];
