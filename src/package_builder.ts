import { DynamoDBClient, ScanCommand, ScanCommandOutput } from "@aws-sdk/client-dynamodb";

type Package = {
  package_name: string;
  repo_name: string;
  dependencies: Record<string, string>;
  dev_dependencies: Record<string, string>;
};

const DYNAMODB_TABLE = "RepoDependancies";

export class PackageBuilder {
  private client: DynamoDBClient;

  constructor() {
    this.client = new DynamoDBClient({ region: "eu-west-1" });
  }

  public async getPackages(): Promise<Package[]> {
    const scanCommand = new ScanCommand({
      TableName: DYNAMODB_TABLE,
    });

    try {
      const result: ScanCommandOutput = await this.client.send(scanCommand);

      const pkgs: Package[] = result.Items?.map(item => {
        return {
          package_name: item["package_name"]?.S || "",
          repo_name: item["repo_name"]?.S || "",
          dependencies: JSON.parse(item["dependencies"]?.S || "{}"),
          dev_dependencies: JSON.parse(item["dev_dependencies"]?.S || "{}"),
        };
      }) || [];

      return pkgs;

    } catch (error) {
      console.error("Error fetching data from DynamoDB:", error);
      throw new Error("Failed to fetch data from DynamoDB");
    }
  }
}
