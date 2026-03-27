/// <reference types="vite/client" />

type BranchResponse = {
  branches: string[];
  current: string;
};

type DiffPayloadFile = {
  chunks: unknown[];
  deletions: number;
  additions: number;
  from: string;
  to: string;
  new: boolean;
  deleted: boolean;
};

declare global {
  interface Window {
    diffViewerAPI: {
      selectRepository: () => Promise<string | null>;
      getBranches: (repoPath: string) => Promise<BranchResponse>;
      getDiff: (payload: {
        repoPath: string;
        workingBranch: string;
        targetBranch: string;
      }) => Promise<{ files: DiffPayloadFile[] }>;
    };
  }
}

export {};
