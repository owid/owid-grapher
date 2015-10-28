<?php

namespace Irazasyed\LaravelGAMP\Facades;

/*
 * Laravel GAMP: Google Analytics - Measurement Protocol
 *
 * NOTICE OF LICENSE
 *
 * Licensed under the MIT License.
 *
 * This source file is subject to the MIT  License that is
 * bundled with this package in the LICENSE file.  It is also available at
 * the following URL: http://opensource.org/licenses/MIT
 *
 * @package       LaravelGAMP
 * @author        Lukonet
 * @license       MIT
 * @copyright (c) 2015 Lukonet Pvt. Ltd.
 * @link          https://lukonet.com
 */

use Illuminate\Support\Facades\Facade;

class GAMP extends Facade
{
    /**
     * Get the registered name of the component.
     *
     * @return string
     */
    protected static function getFacadeAccessor()
    {
        return 'gamp';
    }
}
