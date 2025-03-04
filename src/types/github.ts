export type RepoParams = {
  owner: string;
  repo: string;
};

export type BranchInfo = {
  name: string;
  sha: string;
};

export type TreeItem = {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
};

export type GitHubError = {
  status: number;
  message: string;
};
