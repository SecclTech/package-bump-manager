import * as configModule from './serverless.js';
const config = await (configModule.default || configModule);
export default config;
