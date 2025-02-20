import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

class DependencyStore {
  private dynamodbClient: DynamoDBClient;
  private tableName: string;

  constructor(tableName: string) {
    this.dynamodbClient = new DynamoDBClient({});
    this.tableName = tableName;
  }

  public async store(repoName: string, packageName: string, dependencies: any) {
    if (!repoName || !packageName || !dependencies) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid payload: Missing storage information" })
      };
    }

    try {
      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: {
          "repo_name": { S: repoName },
          "package_name": { S: packageName },
          "dependencies": { S: JSON.stringify(dependencies["dependencies"]) || "" },
          "dev_dependencies": { S: JSON.stringify(dependencies["devDependencies"]) || "" },
        }
      });

      await this.dynamodbClient.send(command);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully stored dependencies for repository '${repoName}' in DynamoDB` })
      };

    } catch (error) {
      console.error("Error: Error storing dependency information - ", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })
      };
    }
  }
}

export default DependencyStore;
