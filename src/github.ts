import { writeFile, readFile } from "fs/promises";
import { exec as execCallback } from "child_process";
import { promisify } from "util";
import { RequestError } from "@octokit/request-error";

const exec = promisify(execCallback);

import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";


export class PRCreator {
  #octokit: Octokit;
  // TODO: Avoid collisions
  #localPath = "/tmp/";
  #paths = ["package.json", "package-lock.json"];

  constructor() {
    const { APP_ID, APP_PRIVATE_KEY, APP_INSTALLATION_ID } = process.env;
    this.#octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: APP_ID,
        privateKey: APP_PRIVATE_KEY,
        installationId: APP_INSTALLATION_ID,
      },
    });
  }

  private async getFiles(owner: string, repo: string, branch: string) {
    const responsePromises = await Promise.all(this.#paths.map(path =>
      this.#octokit.repos.getContent({
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

        const filePath = `${this.#localPath}${data.name}`;
        const pathContents = Buffer.from(data.content, "base64");

        writeFile(filePath, pathContents);
        console.log(`Writing to ${filePath} from ${owner}/${repo} ...`);

        return data.path
      })

    await Promise.all(writePromises);
  }

  private async updatePackageJson(packageName: string, newVersion: string) {
    // TODO: run npm bump on new branch
    await runCommand(`cd ${this.#localPath} && \\` +
      `npm install \\` +
      `${packageName}@${newVersion} \\` +
      `--cache ${this.#localPath} \\` +
      "--package-lock-only \\");
  }

  private async commitFiles(
    owner: string,
    repo: string,
    branch: string,
    baseTreeSha: string,
    latestCommitSha: string,
    commitMessage: string
  ) {
    const readOperations = this.#paths.map(async (path) =>
    ({
      path,
      buf: await readFile(`${this.#localPath}${path}`),
    })
    );

    const updatedFiles = await Promise.all(readOperations);

    const { data: newTree } = await this.#octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: updatedFiles.map(({ path, buf }) => ({
        path,
        mode: "100644",
        type: "blob",
        content: buf.toString(),
      }))
    })

    const { data: newCommit } = await this.#octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha],
    })

    console.log(branch, newCommit.sha)
    await this.#octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
      force: false
    })
  }

  private async createPR(
    owner: string,
    repo: string,
    branch: string,
    title: string,
    defaultBranch: string,
    body: string
  ) {
    const { data: prs } = await this.#octokit.pulls.list({
      owner,
      repo,
      state: "open",
      head: `${owner}:${branch}`,
      base: defaultBranch,
    });

    if (prs.length === 0) {
      console.log("Creating PR")
      // TODO: Assignee
      console.log(defaultBranch, branch)
      const { data: { html_url } } = await this.#octokit.pulls.create({
        owner,
        repo,
        title,
        head: branch,
        base: defaultBranch,
        body,
      });
      return html_url;
    }

    // TODO: Update with correct information
    await this.#octokit.pulls.update({
      owner,
      repo,
      pull_number: prs[0].number,
      body: prs[0].body + "\n more stuff"
    });

    return prs[0].html_url;
  }

  private async getDefaultBranch(owner: string, repo: string) {
    const { data: { default_branch } } = await this.#octokit.repos.get({
      owner,
      repo,
    });

    const { data: { commit: { sha } } } = await this.#octokit.repos.getBranch({
      owner,
      repo,
      branch: default_branch
    });

    return {
      name: default_branch,
      sha
    };
  }

  private async getOrCreateBranch(owner: string, repo: string, branch: string, defaultBranchSha: string) {
    try {
      const { data } = await this.#octokit.repos.getBranch({
        owner,
        repo,
        branch
      });
      return data.commit.sha;
    } catch (error) {
      if ((error as RequestError).status === 404) {
        await this.#octokit.git.createRef({
          owner, repo, ref: `refs/heads/${branch}`, sha: defaultBranchSha
        })
      }
      return defaultBranchSha;
    }
  }

  async createPackageUpdatePR({ owner, repo, packageName, newVersion }: { owner: string; repo: string; packageName: string; newVersion: string; }) {

    // TODO: Add Jira ticket number
    const branch = `SECCL_000000`
    const title = `Update ${packageName} to ${newVersion}`
    // TODO: Link to PR ref that created
    const body = `This PR updates ${packageName} to version ${newVersion}.`
    const commitMessage = `update ${packageName} to ${newVersion}`

    const defaultBranch = await this.getDefaultBranch(owner, repo);
    const latestCommitSha = await this.getOrCreateBranch(owner, repo, branch, defaultBranch.sha);

    await this.getFiles(owner, repo, branch);
    await this.updatePackageJson(packageName, newVersion);
    // TODO: Do not push if no changes
    await this.commitFiles(
      owner, repo, branch, defaultBranch.sha, latestCommitSha, commitMessage
    );

    return await this.createPR(
      owner, repo, branch, title, defaultBranch.name, body
    );
  }
}

async function runCommand(command: string) {
  const { stdout, stderr } = await exec(command);
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  console.log(`stdout: \n${stdout}`);
}

const gh = new PRCreator();
gh.createPackageUpdatePR({ owner: "seccl-platform-test", repo: "foo", packageName: "typescript", newVersion: "4.3.5" });
