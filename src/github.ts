import { writeFile, readFile } from "fs/promises";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const exec = promisify(execCallback);

import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";


export class PRCreator {
  private octokit: Octokit;
  private localPath: string;

  constructor() {
    const { APP_ID, APP_PRIVATE_KEY, APP_INSTALLATION_ID } = process.env;
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: APP_ID,
        privateKey: APP_PRIVATE_KEY,
        installationId: APP_INSTALLATION_ID,
      },
    });
    // TODO: Avoid collisions
    this.localPath = "/tmp/";
  }

  private async getFiles(owner: string, repo: string, branch: string) {
    const paths = ["package.json", "package-lock.json"];

    const responsePromises = await Promise.all(paths.map(path =>
      this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      })
    ));

    const writePromises = responsePromises
      .map(({ data }) => {
        if (!("content" in data)) {
          throw new Error(
            `data.content is missing from getContent response ${owner}/${repo}`
          );
        }

        const filePath = `${this.localPath}${data.name}`;
        const pathContents = Buffer.from(data.content, "base64");

        writeFile(filePath, pathContents);
        console.log(`Writing to ${filePath} from ${owner}/${repo} ...`);

        return {
          sha: data.sha,
          path: data.path,
        }
      })

    return Promise.all(writePromises);
  }

  private async updatePackageJson(packageName: string, newVersion: string) {
    await runCommand(`cd ${this.localPath} && \\` +
      `npm install \\` +
      `${packageName}@${newVersion} \\` +
      `--cache ${this.localPath} \\` +
      "--package-lock-only \\");
  }

  private async commitFiles(
    owner: string,
    repo: string,
    branchName: string,
    commitMessage: string,
    files: { sha: string; path: string; }[]
  ) {

    const readOperations = files.map(async ({ path, sha }) =>
    ({
      path,
      sha,
      buf: await readFile(`${this.localPath}${path}`),
    })
    );

    const updatedFiles = await Promise.all(readOperations);

    const commitOperations = updatedFiles.map(({ path, buf, sha }) =>
      this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: commitMessage,
        content: buf.toString("base64"),
        branch: branchName,
        sha,
      })
    )

    await Promise.all(commitOperations);
  }

  private async createPR(owner: string, repo: string, branchName: string, title: string, defaultBranch: string, body: string) {
    // TODO: Assignee
    const { data: { html_url } } = await this.octokit.pulls.create({
      owner,
      repo,
      title,
      head: branchName,
      base: defaultBranch,
      body,
    });

    return html_url;
  }

  private async getDefaultBranch(owner: string, repo: string) {
    const { data: { default_branch } } = await this.octokit.repos.get({
      owner,
      repo,
    });

    const { data: { commit: { sha } } } = await this.octokit.repos.getBranch({
      owner,
      repo,
      branch: default_branch
    });

    return {
      name: default_branch,
      sha,
    }
  }

  private async createBranch(owner: string, repo: string, branchName: string, latestSha: string) {

    try {
      await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
    } catch {
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: latestSha,
      });
    }
  }

  async createPackageUpdatePR({ owner, repo, packageName, newVersion }: { owner: string; repo: string; packageName: string; newVersion: string; }) {

    // TODO: Add Jira ticket number
    const branchName = `SECCL_000000`
    const title = `Update ${packageName} to ${newVersion}`
    // TODO: Link to PR ref that created
    const body = `This PR updates ${packageName} to version ${newVersion}.`
    const commitMessage = `update ${packageName} to ${newVersion}`

    const defaultBranch = await this.getDefaultBranch(owner, repo);

    await this.createBranch(owner, repo, branchName, defaultBranch.sha);

    const files = await this.getFiles(owner, repo, branchName);
    await this.updatePackageJson(packageName, newVersion);
    await this.commitFiles(
      owner,
      repo,
      branchName,
      commitMessage,
      files
    );
    return await this.createPR(
      owner,
      repo,
      branchName,
      title,
      defaultBranch.name,
      body
    );
  }
}

async function runCommand(command: string) {
  try {
    const { stdout, stderr } = await exec(command);
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    console.log(`stdout: \n${stdout}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing ${command}: ${errorMessage}`);
  }
}

const gh = new PRCreator();
gh.createPackageUpdatePR({ owner: "seccl-platform-test", repo: "foo", packageName: "typescript", newVersion: "4.3.5" });
