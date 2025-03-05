export type RepoParams = {
  owner: string;
  repositoryId?: string;
  repo?: string;
};

export interface CreateBranchParams extends RepoParams {
  branch: string;
  defaultBranchSha: string
}

export interface RepositoryQueryResponse {
  repository: {
    id: string;
    defaultBranchRef: {
      name: string;
      target: {
        oid: string;
      }
    };
    pullRequests: {
      edges: {
        node: {
          title: string;
          number: number;
          body: string;
          url: string;
        };
      }[];
    };
    ref?: {
      target: {
        oid: string;
      }
    };
  };
}

export interface FileAdditionInput {
  path: string;
  contents: string;
}

export interface CreateCommitOnBranchVariables {
  repositoryId: string;
  branchName: string;
  latestCommitSha: string;
  commitMessage: string;
  fileAdditions: FileAdditionInput[];

  [key: string]: unknown;
}

export interface CreateCommitOnBranchResponse {
  createCommitOnBranch: {
    commit: {
      oid: string;
      url: string;
    };
  };
}
