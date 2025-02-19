import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

export class GithubPRCreator {
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

    async createPackageUpdatePR({ owner, repo, packageName, newVersion }: { owner: string; repo: string; packageName: string; newVersion: string; }) {
        const branchName = `update-${packageName}-to-${newVersion}`;

        const { data: repoData } = await this.octokit.repos.get({ owner, repo });
        const defaultBranch = repoData.default_branch;

        const { data: latestCommit } = await this.octokit.repos.getBranch({ owner, repo, branch: defaultBranch });
        await this.octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: latestCommit.commit.sha,
        });

        const packageJsonPath = "package.json";
        const { data: packageJsonFile } = await this.octokit.repos.getContent({
            owner,
            repo,
            path: packageJsonPath,
            ref: defaultBranch,
        });

        if (!("content" in packageJsonFile) || !packageJsonFile.content) {
            throw new Error("package.json content not found or is a directory.");
        }

        const packageJsonContent = JSON.parse(
            Buffer.from(packageJsonFile.content, "base64").toString("utf-8")
        );

        if (packageJsonContent.dependencies?.[packageName]) {
            packageJsonContent.dependencies[packageName] = newVersion;
        } else if (packageJsonContent.devDependencies?.[packageName]) {
            packageJsonContent.devDependencies[packageName] = newVersion;
        } else {
            throw new Error(`Package ${packageName} not found in dependencies or devDependencies.`);
        }

        const updatedContent = Buffer.from(
            JSON.stringify(packageJsonContent, null, 2)
        ).toString("base64");

        await this.octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: packageJsonPath,
            message: `Update ${packageName} to ${newVersion}`,
            content: updatedContent,
            branch: branchName,
            sha: packageJsonFile.sha,
        });

        const { data: pr } = await this.octokit.pulls.create({
            owner,
            repo,
            title: `Update ${packageName} to ${newVersion}`,
            head: branchName,
            base: defaultBranch,
            body: `This PR updates ${packageName} to version ${newVersion}.`,
        });

        return pr.html_url;
    }
}
