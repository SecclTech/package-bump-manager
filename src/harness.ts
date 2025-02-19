import { Context } from 'aws-lambda';
import { handler } from './index.js';

const events = {};
const context: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: '',
    functionVersion: '',
    invokedFunctionArn: '',
    memoryLimitInMB: '',
    awsRequestId: '',
    logGroupName: '',
    logStreamName: '',
    getRemainingTimeInMillis: function(): number {
        throw new Error('Function not implemented.');
    },
    done: function(error?: Error, result?: any): void {
        throw new Error('Function not implemented.');
    },
    fail: function(error: Error | string): void {
        throw new Error('Function not implemented.');
    },
    succeed: function(messageOrObject: any): void {
        throw new Error('Function not implemented.');
    }
};

handler(events, context);

