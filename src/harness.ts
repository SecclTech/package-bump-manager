import { Context } from 'aws-lambda';
import { handler } from './index.js';

const events = {
  request_type: 'store_dependancy',
};
const context: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: '',
    functionVersion: '',
    invokedFunctionArn: '',
    memoryLimitInMB: '',
    awsRequestId: '',
    logGroupName: '',
    logStreamName: '',
    getRemainingTimeInMillis: function(): number { return 0; },
    done: function(error?: Error, result?: any): void {},
    fail: function(error: Error | string): void {},
    succeed: function(messageOrObject: any): void {}
};

handler(events, context);

