import type {
  Provider,
  Serverless,
  Functions,
  Environment,
  Package,
  Resources
} from 'serverless/aws';

import {
  buildServerless,
  standardSecretsIamRoleStatements,
  standardPatterns,
  standardPlugins,
  defaultNodeLambdaEnvironmentVars,
  standardConfigLoader,
  configureDataDog,
  messageRetentionPeriod
} from '@seccl/serverless-utils';

if (!process.env.STAGE_ENV) {
  throw new Error('STAGE_ENV must be set!');
}

import packageJson from './package.json' with { type: 'json' }
import secrets from './secrets-config.json' with { type: 'json' }

const stage = process.env.STAGE_ENV;
const coreEnv: string = process.env.CORE_ENV ?? 'genshared';

const settingsJson = standardConfigLoader();

const secretsManagerArn: string = settingsJson.secretsManagerArn;
const runtime: string = 'nodejs22.x';
const region: string = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'eu-west-1';
const packageVersion: string = packageJson.version ?? process.env.PACKAGE_VERSION ?? 'unknown';
const serviceName: string = packageJson.name.replace('@seccl/', '');

const environmentVars: Environment = {
  ...defaultNodeLambdaEnvironmentVars,
  STAGE_ENV: stage,
  CORE_ENV: coreEnv,
  PACKAGE_VERSION: packageVersion,
  TZ: 'Etc/UTC',
  BASE_SQS_URL: 'https://sqs.${aws:region}.amazonaws.com/${aws:accountId}/',
  SECRETS_MANAGER_ARN: secretsManagerArn,
  DD_EXTENSION_VERSION: 'compatibility',
};

const provider: Provider = {
  name: 'aws',
  stage,
  runtime,
  region,
  environment: environmentVars,
  deploymentBucket: {
    name: `tech.seccl.${region}.${coreEnv}.serverless-deploys`
  },
  stackTags: {
    PACKAGE_VERSION: packageVersion,
    SYSTEM_DOMAIN: 'shared'
  },
  tags: {
    PACKAGE_VERSION: packageVersion
  },
  vpc: {
    securityGroupIds: settingsJson.awsSecurityGroupIds,
    subnetIds: settingsJson.awsSubnetIds
  },
  logRetentionInDays: 30,
  iam: {
    role: {
      statements: [
        ...standardSecretsIamRoleStatements,
        {
          Effect: 'Allow',
          Action: ['secretsmanager:GetSecretValue'],
          Resource: secrets.map(secret => `${secretsManagerArn}/${secret}-*`)
        },
        {
          Effect: 'Allow',
          Action: [
            'dynamodb:DescribeTable',
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
          ],
          Resource: { 'Fn::GetAtt': ['DependenciesTable', 'Arn'] },
        },
      ],
    },
  },
};

const functions: Functions = {
  service: {
    handler: 'src/index.handler',
    runtime,
    timeout: 30,
    memorySize: 10240,
    environment: {
      DYNAMODB_TABLE: { Ref: 'DependenciesTable' },
    }
  },
};
const resources: Resources = {
  Resources: {
    DependenciesTable: {
      Type: 'AWS::DynamoDB::Table',
      Properties: {
        AttributeDefinitions: [
          {
            AttributeName: 'package_name',
            AttributeType: 'S',
          },
        ],
        KeySchema: [
          {
            AttributeName: 'package_name',
            KeyType: 'HASH',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      },
    },
    PackageBumpEventQueue: {
      Type: 'AWS::SQS::Queue',
      Properties: {
        DelaySeconds: 0,
        MessageRetentionPeriod: messageRetentionPeriod,
        VisibilityTimeout: 1800,
        QueueName: `${stage}-package-bump-manager-event-queue`,
        RedrivePolicy: {
          maxReceiveCount: 1,
          deadLetterTargetArn: {
            'Fn::GetAtt': ['PackageBumpEventDLQ', 'Arn']
          }
        }
      }
    },
    PackageBumpEventDLQ: {
      Type: 'AWS::SQS::Queue',
      Properties: {
        DelaySeconds: 0,
        MessageRetentionPeriod: messageRetentionPeriod,
        VisibilityTimeout: 30,
        QueueName: `${stage}-package-bump-manager-event-dlq`
      }
    }
  }
};

const pkg: Package = {
  patterns: [
    '!**',
    'src/*.js',
    'src/**/*.js',
    'package.json',
    'secrets-config.json',
    'node_modules/**/*.js',
    'node_modules/**/*.cjs',
    'node_modules/**/*.mjs',
    'node_modules/**/*.json',
    '!node_modules/@types',
    ...standardPatterns
  ],
  excludeDevDependencies: true,
};

const custom = {
  datadog: configureDataDog(`${secretsManagerArn}/datadog-api`, packageVersion),
  prune: {
    automatic: true,
    number: 3
  }
}

const serverless: Serverless = {
  service: serviceName,
  provider,
  functions,
  resources,
  package: pkg,
  plugins: standardPlugins,
  custom
};

export default buildServerless(serverless);
