export type DeploymentEnvironment =
  | "production"
  | "preview"
  | "development"
  | "local";

export interface DeploymentMetadata {
  gitCommitSha: string | null;
  gitCommitShort: string | null;
  gitBranch: string | null;
  environment: DeploymentEnvironment;
  nodeEnv: string;
  vercelUrl: string | null;
  vercelDeploymentId: string | null;
  buildTime: string | null;
}

function shortSha(sha: string | null | undefined): string | null {
  if (!sha) return null;
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

function resolveGitCommitSha(): string | null {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ??
    null
  );
}

function resolveDeploymentEnvironment(): DeploymentEnvironment {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "development") return "development";
  if (process.env.NODE_ENV === "production") return "production";
  return "local";
}

/** Build/deployment metadata for comparing local vs live behavior. */
export function getDeploymentMetadata(): DeploymentMetadata {
  const gitCommitSha = resolveGitCommitSha();
  return {
    gitCommitSha,
    gitCommitShort: shortSha(gitCommitSha),
    gitBranch:
      process.env.VERCEL_GIT_COMMIT_REF ??
      process.env.GIT_BRANCH ??
      null,
    environment: resolveDeploymentEnvironment(),
    nodeEnv: process.env.NODE_ENV ?? "development",
    vercelUrl: process.env.VERCEL_URL ?? null,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    buildTime: process.env.BUILD_TIME ?? null,
  };
}
