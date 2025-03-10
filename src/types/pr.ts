import { RepoParams } from './github.js';

export type PackageUpdateParams = RepoParams & {
  packageName: string;
  newVersion: string;
  repo: string;
};

export type PullRequestParams = RepoParams & {
  branch: string;
  title: string;
  body: string;
  baseBranch: string;
};
