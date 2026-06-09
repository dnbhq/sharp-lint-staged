import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Config } from 'release-it';

type PackageJsonRepository =
  | string
  | {
      type?: string;
      url?: string;
      directory?: string;
    };

interface PackageJson {
  repository?: PackageJsonRepository;
}

interface GitHubRepositoryInfo {
  owner: string;
  repo: string;
  baseUrl: string;
}

/**
 * Reads and parses the repository's package.json file.
 *
 * @param packageJsonPath - Absolute or relative path to package.json.
 * @returns The parsed package.json content.
 *
 * @throws If package.json cannot be read.
 * @throws If package.json does not contain a JSON object.
 */
function readPackageJson(packageJsonPath: string): PackageJson {
  const absolutePath = resolve(packageJsonPath);

  let rawPackageJson: string;

  try {
    rawPackageJson = readFileSync(absolutePath, 'utf8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Could not read package.json at "${absolutePath}": ${message}`);
  }

  let parsedPackageJson: unknown;

  try {
    parsedPackageJson = JSON.parse(rawPackageJson);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Could not parse package.json at "${absolutePath}": ${message}`);
  }

  if (
    typeof parsedPackageJson !== 'object' ||
    parsedPackageJson === null ||
    Array.isArray(parsedPackageJson)
  ) {
    throw new Error(`Invalid package.json at "${absolutePath}": expected a JSON object.`);
  }

  return parsedPackageJson as PackageJson;
}

/**
 * Extracts the repository value from package.json.
 *
 * @param packageJson - Parsed package.json content.
 * @returns The repository string.
 *
 * @throws If the repository field is missing or unsupported.
 */
function getRepositoryValue(packageJson: PackageJson): string {
  const { repository } = packageJson;

  if (typeof repository === 'string') {
    return repository;
  }

  if (
    typeof repository === 'object' &&
    repository !== null &&
    typeof repository.url === 'string'
  ) {
    return repository.url;
  }

  throw new Error(
    'Missing or invalid "repository" field in package.json. Expected a string or an object with a "url" property.',
  );
}

/**
 * Normalises common GitHub repository formats to owner/repo information.
 *
 * Supported examples:
 * - davidsneighbour/imagemin-lint-staged
 * - github:davidsneighbour/imagemin-lint-staged
 * - https://github.com/davidsneighbour/imagemin-lint-staged
 * - git+https://github.com/davidsneighbour/imagemin-lint-staged.git
 * - git@github.com:davidsneighbour/imagemin-lint-staged.git
 *
 * @param repositoryValue - Repository value from package.json.
 * @returns Normalised GitHub repository information.
 *
 * @throws If the repository value is not a supported GitHub repository format.
 */
function parseGitHubRepository(repositoryValue: string): GitHubRepositoryInfo {
  const normalisedRepository = repositoryValue
    .trim()
    .replace(/^git\+/, '')
    .replace(/^github:/, '')
    .replace(/^git@github\.com:/, '')
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/^ssh:\/\/git@github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

  const match = /^(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)$/.exec(
    normalisedRepository,
  );

  if (match?.groups === undefined) {
    throw new Error(
      `Unsupported GitHub repository format in package.json: "${repositoryValue}".`,
    );
  }

  const { owner, repo } = match.groups;

  if (owner === undefined || repo === undefined) {
    throw new Error(
      `Could not extract GitHub owner and repository from package.json repository value: "${repositoryValue}".`,
    );
  }

  return {
    owner,
    repo,
    baseUrl: `https://github.com/${owner}/${repo}`,
  };
}

/**
 * Builds GitHub changelog URL formats for conventional-changelog.
 *
 * @param packageJsonPath - Path to package.json.
 * @returns Commit and compare URL format strings.
 */
function getGitHubChangelogUrls(packageJsonPath = './package.json'): {
  commitUrlFormat: string;
  compareUrlFormat: string;
} {
  const packageJson = readPackageJson(packageJsonPath);
  const repositoryValue = getRepositoryValue(packageJson);
  const repository = parseGitHubRepository(repositoryValue);

  return {
    commitUrlFormat: `${repository.baseUrl}/commit/{{hash}}`,
    compareUrlFormat: `${repository.baseUrl}/compare/{{previousTag}}...{{currentTag}}`,
  };
}

const { commitUrlFormat, compareUrlFormat } = getGitHubChangelogUrls();

const config = {
  npm: {
    publish: false,
  },
  git: {
    requireCleanWorkingDir: true,
    commit: true,
    commitMessage: 'chore(release): v${version}',
    commitArgs: ['--no-verify'],
    tag: true,
    tagName: 'v${version}',
    push: true,
    pushArgs: ['--follow-tags'],
  },
  github: {
    release: true,
    releaseName: 'v${version}',
    skipChecks: true,
    tokenRef: 'GITHUB_TOKEN_CONTENT_PRIVATE',
  },
  plugins: {
    '@release-it/conventional-changelog': {
      infile: 'CHANGELOG.md',
      preset: {
        name: 'conventionalcommits',
        commitUrlFormat,
        compareUrlFormat,
        types: [
          { type: 'content', section: 'Content' },
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'build', section: 'Build' },
          { type: 'chore', section: 'Chores' },
          { type: 'ci', section: 'CI' },
          { type: 'docs', section: 'Documentation' },
          { type: 'perf', section: 'Performance' },
          { type: 'refactor', section: 'Refactoring' },
          { type: 'revert', section: 'Reverts' },
          { type: 'style', section: 'Styles' },
          { type: 'test', section: 'Tests' },
        ],
      },
      whatBump(commits: Array<{ type?: string; notes?: unknown[] }>) {
        let level: 2 | 1 | 0 | null = null;

        for (const commit of commits) {
          const notes = Array.isArray(commit.notes) ? commit.notes : [];
          const type = typeof commit.type === 'string' ? commit.type : '';

          if (notes.length > 0) {
            return {
              level: 0,
              reason: 'There are BREAKING CHANGES.',
            };
          }

          if (type === 'feat' || type === 'content') {
            level = 1;
            continue;
          }

          if (
            level === null &&
            [
              'fix',
              'build',
              'chore',
              'ci',
              'docs',
              'perf',
              'refactor',
              'revert',
              'style',
              'test',
            ].includes(type)
          ) {
            level = 2;
          }
        }

        if (level === null) {
          return false;
        }

        return {
          level,
          reason:
            level === 1
              ? 'There are feat/content commits.'
              : 'There are patch-level changes.',
        };
      },
    },
  },
} satisfies Config;

export default config;