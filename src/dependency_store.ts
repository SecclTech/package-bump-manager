import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

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

    try {
      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: {
          "repo_name": { S: repository },
          "package_name": { S: package_name },
          "dependencies": { S: JSON.stringify(dependencies["dependencies"]) || "" },
          "dev_dependencies": { S: JSON.stringify(dependencies["devDependencies"]) || "" },
        }
      });

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

