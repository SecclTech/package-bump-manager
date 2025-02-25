import { AttributeValue, DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

export default class DependencyStore {
  private dynamodbClient: DynamoDBClient;
  private tableName: string;

  constructor(tableName: string) {
    this.dynamodbClient = new DynamoDBClient({});
    this.tableName = tableName;
  }

  public async store(event: Record<string, any>) {

    const { repository, package_name, dependencies } = event;
    if (!repository || !package_name || !dependencies) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid payload: repository, package_name, and dependencies are required fields"
        })
      };
    }

    const Item: Record<string, AttributeValue> = {
      repo_name: { S: repository },
      package_name: { S: package_name },
    }
    const deps = filterDependencies(dependencies.dependencies);
    Item.dependencies = { S: JSON.stringify(deps) };

    const devDeps = filterDependencies(dependencies.devDependencies);
    Item.devDependencies = { S: JSON.stringify(devDeps) };

    console.log("Inserting item:", Item);

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item,
    });

    try {
      await this.dynamodbClient.send(command);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Successfully stored dependencies for repository '${repository}' in DynamoDB`
        })
      };

    } catch (error) {
      console.error("Error: Error storing dependency information - ", error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }
}

function filterDependencies(dependencies: any) {
  if (!isRecordOfString(dependencies)) {
    return {};
  }
  return Object.fromEntries(Object.entries(dependencies).filter(
    ([k,]) => k.startsWith('@seccl/')
  ));
}

function isRecordOfString(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, val]) => typeof key === 'string' && typeof val === 'string'
    )
  );
}

