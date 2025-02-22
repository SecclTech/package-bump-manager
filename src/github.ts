import { writeFile } from "fs/promises";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const exec = promisify(execCallback);

import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";


export class PRCreator {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.APP_ID,
        privateKey: process.env.APP_PRIVATE_KEY,
        installationId: process.env.APP_INSTALLATION_ID,
      },
    });
  }

  private async fetchPackageJson(owner: string, repo: string) {
    const paths = ["package.json", "package-lock.json"];

    const responsePromises = await Promise.all(paths.map(path =>
      this.octokit.repos.getContent({
        owner,
        repo,
        path,
      })
    ));

    const writePromises = responsePromises
      .map((res) => {
        if (!("content" in res.data)) {
          throw new Error(
            `data.content is missing from getContent response ${res}`
          );
        }
        const filePath = `/tmp/${res.data.name}`;
        const pathContents = Buffer.from(res.data.content, "base64");

        writeFile(filePath, pathContents);
        console.log(`Writing to ${filePath} from ${owner}/${repo} ...`);
      })

    await Promise.all(writePromises);
  }

  private async updatePackageJson(owner: string, repo: string, packageName: string, newVersion: string) {

    console.log(packageName)
    runScript("npm install \\" +
      "--package-lock-only \\" +
      "--cache /tmp \\" +
      "--prefix /tmp");

  }

  async createPackageUpdatePR({ owner, repo, packageName, newVersion }: { owner: string; repo: string; packageName: string; newVersion: string; }) {

    //await this.fetchPackageJson(owner, repo);
    await this.updatePackageJson(owner, repo, packageName, newVersion);

    const branchName = `update-${packageName}-to-${newVersion}`;


    return "";



    //
    //    const updatedContent = Buffer.from(
    //      JSON.stringify(packageJsonContent, null, 2)
    //    ).toString("base64");
    //
    //    await this.octokit.repos.createOrUpdateFileContents({
    //      owner,
    //      repo,
    //      path: packageJsonPath,
    //      message: `Update ${packageName} to ${newVersion}`,
    //      content: updatedContent,
    //      branch: branchName,
    //      sha: packageJsonFile.sha,
    //    });
    //
    //    const { data: pr } = await this.octokit.pulls.create({
    //      owner,
    //      repo,
    //      title: `Update ${packageName} to ${newVersion}`,
    //      head: branchName,
    //      base: defaultBranch,
    //      body: `This PR updates ${packageName} to version ${newVersion}.`,
    //    });
    //
    //    return pr.html_url;
  }
}

async function runScript(command: string) {
  try {
    const { stdout, stderr } = await exec(command);
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    console.log(`stdout:\n${stdout}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing ${command}: ${errorMessage}`);
  }
}

const gh = new PRCreator();
gh.createPackageUpdatePR({ owner: "seccl-platform-test", repo: "foo", packageName: "typescript", newVersion: "4.3.5" });
