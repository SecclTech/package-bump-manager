import { Context, SQSEvent } from 'aws-lambda'
import { handler } from './index.js';

const events: SQSEvent = {
  Records: []
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
  done: function(_error?: Error, _result?: any): void { },
  fail: function(_error: Error | string): void { },
  succeed: function(_messageOrObject: any): void { }
};

handler(events, context).then(res => console.log(res));

