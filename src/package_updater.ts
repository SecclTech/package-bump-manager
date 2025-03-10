import semver from "semver";
import { createPackageUpdatePR } from './pr-creator.js'
import {
  DynamoDBClient,
  ScanCommand,
  ScanCommandOutput
} from '@aws-sdk/client-dynamodb'
import { Job } from "./types/job.js";

type Package = {
  package_name: string;
  package_path: string;
  repo_name: string;
  dependencies: Record<string, string>;
  is_workspace: boolean;
};


export async function bumpParents(job: Job, parents: Package[], gitOwner: string) {
  if (parents.length === 0) {
    console.log("No parent dependencies found that need an update.");
    return;
  }

  const prResults: { repo: string; prUrl?: string; error?: string }[] = [];

  const { updated_package_name, updated_package_version } = job;

  for (const parent of parents) {
    const repoName = parent.repo_name;
    const prUrl = await createPackageUpdatePR({
      owner: gitOwner,
      repo: repoName,
      packageName: updated_package_name,
      newVersion: updated_package_version,
    });
    console.log("PR created successfully:", prUrl);
    prResults.push({ repo: repoName, prUrl });
  }
}

export async function getPackages(tableName: string) {
  const client = new DynamoDBClient({ region: "eu-west-1" });

  const scanCommand = new ScanCommand({
    TableName: tableName,
  });

  const result: ScanCommandOutput = await client.send(scanCommand);

  return result.Items?.map(item => {
    return {
      package_name: item["package_name"]?.S || "",
      package_path: item["package_path"]?.S || "",
      repo_name: item["repo_name"]?.S || "",
      dependencies: JSON.parse(item["dependencies"]?.S || "{}"),
      is_workspace: item["is_workspace"]?.BOOL || false
    };
  }) || [];
}

export function findParents(packages: Package[], job: Job) {
  const { updated_package_name, updated_package_version } = job;
  return packages.filter((pkg) => {
    const depVersion = pkg.dependencies[updated_package_name];
    return depVersion && semver.gt(updated_package_version, depVersion)
  })
}
