### 1.2.0 (2015-07-19)
 * Updating dependencies
 * Adding Content Grouping support by @lombo

### 1.1.5 (2015-07-03)
 * Updating dependencies
 * Creating separate branches to maintain v1 and v2 apart

### 1.1.4 (2015-04-18)
 * Updating dependencies
 * Including Yii 2 integration by @baibaratsky
 * Placing project in CI with PHP 5.6 and 7

### 1.1.3 (2015-03-17)
 * Updating dependencies
 * Using caret for declaring dependencies in Composer, as per author's recommendation

### 1.1.2 (2015-03-07)
 * Creating setAsyncRequest(boolean $isAsyncRequest) method to be used instead of makeNonBlocking(). Its more flexible.
 * makeNonBlocking() is now deprecated, use setAsyncRequest() instead. To be removed in next major release.

### 1.1.1 (2015-02-26)
 * Changing HTTPS endpoint to official one in Google documentation
 * Adding Data Source parameter
 * Adding Geographical Override parameter

### 1.1.0 (2015-02-25)
 * Adding the capability of sending hits to GA in an asynchronous way (non-blocking)

### 1.0.1 (2015-02-03)
 * Minor bug fixes

### 1.0.0 (2015-01-30)

 * First stable release
 * Full implementation of GA measurement protocol (AFAIK, feel free to open issue/pull request)
 * 100% code coverage for unit tests
 * Only missing documentation and integration tests to be added in next minor release

### 0.1.1 (2014-10-01)

  * Fixing bug where ecommerce transaction was not collected because data was being sent as POST body instead
  of URL query parameters

### 0.1.0 (2014-09-25)

  * Added send pageview and event
  * All required parameters for pageview and events implemented
  * Alpha testing of transaction tracking with Enhanced Ecommerce

### 0.1-alpha.0 (2014-09-24)

  * Initial release
