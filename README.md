# coworkers-errors [![Build Status](https://travis-ci.org/tjmehta/coworkers-errors.svg?branch=master)](https://travis-ci.org/tjmehta/coworkers-errors)
Errors and errorHandler useful for "coworkers" applications

# Installation
```bash
npm i --save coworkers-errors
```

# Usage

### PermanentError
Permanent errors represent errors that cannot be resolved (cannot be retried)

##### Example: Using PermanentError
```js
const PermanentError = require('coworkers-errors/permanent-error')

const data = { foo: 'bar' } // optional

// create an error
const err = new PermanentError('boom', data)

// wrap an error
const wrapped = PermanentError.wrap(new Error('boom'), data)

// wrap and immediately throw the error
PermanentError.throw(new Error('boom'), data)
```

### RetryableError
Retryable errors represent errors that temporary and result in the message being retried

##### Example: Using RetryableError
```js
const RetryableError = require('coworkers-errors/retryable-error')

const data = { foo: 'bar' } // optional

// create an error
const err = new RetryableError('boom', data)

// wrap an error
const wrapped = RetryableError.wrap(new Error('boom'), data)

// wrap and immediately throw the error
RetryableError.throw(new Error('boom'), data)
```

### FatalError
Fatal errors represent errors that should crash the process

##### Example: Using FatalError
```js
const FatalError = require('coworkers-errors/fatal-error')

const data = { foo: 'bar' } // optional

// create an error
const err = new FatalError('boom', data)

// wrap an error
const wrapped = FatalError.wrap(new Error('boom'), data)

// wrap and immediately throw the error
FatalError.throw(new Error('boom'), data)

// FatalError have this additional method:
// wrap and immediately next tick throw the error
FatalError.throwNextTick(new Error('boom'), data)
```

### AppError
Base error class which the others inherit from

##### Example: Create a CustomError class using AppError
```js
const AppError = require('coworkers-errors/app-error')

class CustomError extends AppError {
  constructor (message, data) {
    super(message, data)
    this.name = 'CustomError'
  }
}
const data = { foo: 'bar' } // optional

const err = new CustomError('boom', data)

const wrapped = CustomError.wrap(new Error('boom'), data)
CustomError.throw(new Error('boom'), data)
```

### ErrorHandler - Expirimental
Coworkers-errors offers a good default error-handler to use when using these errors.
It can also be fully customized w/ options; checkout "Error-handler options" below.

##### Fatal Error Handling (fatalErrorHandler)
* Fatal errors are published to the dead-letter-exchange w/ routingKey "fatal-error" (or specified), and the message is acked.
* Finally, the error is thrown next-tick as an uncaught-exception (to crash the process).

##### Permanent Error (permanentErrorHandler)
* Permanent errors are published to the dead-letter-exchange w/ routingKey "permanent-error" (or specified), and the message is acked.

##### Retryable Errors (retryableErrorHandler)
* Retryable errors are published to the dead-letter-exchange w/ same routingKey (which the message was published with), and the message is acked.
* The published message is published w/ new `x-death` headers just as if it was rejected or timedout (except w/ "reason": "retryable-error").`
* The dead letter exchange should be setup w/ queue that dead letters back to the original queue.
* If the message fails more than maxAttempts the error will wrapped as a permanent error and handled by permanentErrorHandler.
* Uses the following options
  * `.retry`:
    * `.startInterval` - starting timeout for retry in ms, default: 500
    * `.multiplier` - factor to increase timeout by each attempt, default: 4
    * `.maxInterval` - max timeout for retry in ms, default: 10000 (10s)
    * `.maxAttempts` - max number of attempts to retry, default: Infinity

##### Unexpected Errors
* Unexpected errors are wrapped as retryable errors and handled by retryableErrorHandler.
* Once the error is published to the retryable-error queue and acked, the error wrapped as a FatalError and next-tick thrown as an uncaught-exception to crash the process.

##### Note on dead-letter-exchange and queue options
* Make sure to set timeouts and dead-letters-exchange for all coworkers queues when using error-handler.
* PermanentErrorDeadLetterQueue should be bound to the dlx w/ routingPattern "permanent-error"
* FatalErrorDeadLetterQueue should be bound to the dlx w/ routingPattern "fatal-error"
* RetryableErrorDeadLetterQueue should be bound to the dlx w/ routingPattern "#"
* Timedout (queue-message-ttl or per-message-ttl) message will end up in the RetryableErrorDeadLetterQueue
  * Timedout messages will not be retried w/ backoff (as they are handled completely w/in rabbitmq)
  * RetryableErrorDeadLetterQueue should also have a timeout so that timedout messages are retried
* If you need timedout messages to be handled w/ backoff, do not rely on rabbitmq's timeout, and handle timeouts w/in the coworkers app via middleware (throw a RetryableError)

##### Error-handler options
  * `log` - specify your own logger, must have `log.error`
  * `routingKeys` - specify dead-letter-exchange routing keys for each type of error classes
    * By default, this error handler will create queues for each type of error recieved on a queue
    * `fatal` - dead-letter-exchange routingKey for fatal errors, default: "fatal-error"
    * `permanent` - dead-letter-exchange routingKey for permanent errors, default: "permanent-error"
    * `retryable` - dead-letter-exchange routingKey for retryable errors, default: <same-as-message>
  * `retry`:
    * `startInterval` - starting timeout for retry in ms, default: 500
    * `multiplier` - factor to increase timeout by each attempt, default: 4
    * `maxInterval` - max timeout for retry in ms, default: 10000 (10s)
    * `maxAttempts` - max number of attempts to retry, default: Infinity
  * `finally` - allows final behavior before error is published the dead-letter-exchange (good place for cleanup, or replying to repc)
    * example below

##### Error-handler w/ options example:
```js
const coworkers = require('coworkers')
const errorHandler = require('coworkers-errors/error-handler')
const PermanentError = require('coworkers-errors/permanent-error')
const log = require('./log.js')

const app = coworkers()

app.queue('some-queue', ...)

app.on('error', errorHandler({
  log: log, // must have log.error,
  retry: {
    startInterval: 500,
    multiplier: 10,
    maxInterval: 10 * 1000
    maxAttempts: 100
  },
  routingKeys: {
    delimeter: '.',
    permanent: 'permanent-error'
    fatal: 'fatal-error'
    retryable: 'retryable-error'
  },
  finally: function (err, context) {
    if (context.headers.replyTo && err instanceof PermanentError) {
      context.reply({ error: err.toJSON() }) // reply w/ custom error format
    }
    if (context.dbConnection) {
      dbConnection.close()
    }
  }
}))

# License
MIT
