import * as vscode from "vscode";
import { Pet, GIT_COMMIT, GIT_BRANCH_CREATED, GIT_MERGE, EXPERIENCE_ADDED } from "../types";
import { RegisterTrackerFn } from "./types";

type GitAPI = {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
};

type GitExtension = {
  getAPI(version: 1): GitAPI;
};

async function requireGitApi() {
  const extension = vscode.extensions.getExtension<GitExtension>("vscode.git");

  if (!extension) {
    throw new Error("Built-in Git extension is disabled or unavailable");
  }

  if (!extension.isActive) {
    await extension.activate();
  }

  return extension.exports.getAPI(1);
}

type GitRef = {
  name?: string;
};

type GitCommit = {
  parents?: string[];
  hash?: string;
};

type GitRepository = {
  rootUri: vscode.Uri;
  state: {
    HEAD?: GitRef;
  };
  onDidCommit: vscode.Event<void>;
  onDidCheckout: vscode.Event<void>;
  getBranches(query: { remote?: boolean }): Promise<GitRef[]>;
  log(options?: { maxEntries?: number }): Promise<GitCommit[]>;
};

type RepoSnapshot = {
  headName: string | null;
  localBranches: Set<string>;
  lastAwardedCommitHash: string | null;
};

export const registerGitExperienceTracking: RegisterTrackerFn = ({
  configManager,
  context,
  logger,
  stateManager,
  petsManager,
  provider,
  checkAchievements,
  checkEvolution,
}) => {
  let gitAPIDisposable: vscode.Disposable;
  let git: GitAPI;
  const snapshots = new Map<string, RepoSnapshot>();
  const config = configManager.loadConfig();

  async function getLocalBranches(repository: GitRepository): Promise<Set<string>> {
    const branches = await repository.getBranches({ remote: false });
    return new Set(
      branches
        .map((branch) => branch.name)
        .filter((name): name is string => Boolean(name)),
    );
  }

  async function ensureSnapshot(repository: GitRepository): Promise<RepoSnapshot> {
    const key = repository.rootUri.toString();
    const existing = snapshots.get(key);

    if (existing) {
      return existing;
    }

    const snapshot: RepoSnapshot = {
      headName: repository.state.HEAD?.name ?? null,
      localBranches: await getLocalBranches(repository),
      lastAwardedCommitHash: null,
    };

    snapshots.set(key, snapshot);
    return snapshot;
  }

  function awardXp(
    repository: GitRepository,
    xpToAdd: number,
    type: typeof GIT_COMMIT | typeof GIT_BRANCH_CREATED | typeof GIT_MERGE,
    extra?: Record<string, unknown>,
  ) {
    if (xpToAdd <= 0) {
      return;
    }

    const current = stateManager.get();
    if (current.petId === null) {
      return;
    }

    stateManager.addExp(xpToAdd);

    const updated = stateManager.get();

    if (!updated.petId) {
      return;
    }

    const pet = petsManager.getPet(updated.petId) as Pet;

    provider.postMessage({
      type,
      uri: repository.rootUri.toString(),
      data: {
        experienceAdded: xpToAdd,
        ...extra,
      },
    });

    provider.postMessage({
      type: EXPERIENCE_ADDED,
      data: updated.experience,
    });

    checkEvolution(pet, updated);
    checkAchievements(updated);
  }

  async function handleCommit(repository: GitRepository) {
    const snapshot = await ensureSnapshot(repository);

    let xpToAdd = config.experience.multipliers.gitCommit;
    let isMergeCommit = false;
    let commitHash: string | null = null;

    const latest = await repository.log({ maxEntries: 1 });
    const headCommit = latest[0];

    if (headCommit) {
      commitHash = headCommit.hash ?? null;

      if (commitHash && snapshot.lastAwardedCommitHash === commitHash) {
        return;
      }

      isMergeCommit = (headCommit.parents?.length ?? 0) > 1;
      snapshot.lastAwardedCommitHash = commitHash;
    }

    if (isMergeCommit) {
      xpToAdd += config.experience.multipliers.gitMerge;
    }

    awardXp(repository, xpToAdd, isMergeCommit ? GIT_MERGE : GIT_COMMIT, {
      commitHash,
      merge: isMergeCommit,
    });
  }

  async function handleCheckout(repository: GitRepository) {
    const snapshot = await ensureSnapshot(repository);

    const beforeBranches = snapshot.localBranches;
    const afterBranches = await getLocalBranches(repository);

    const createdBranches: string[] = [];

    for (const branch of afterBranches) {
      if (!beforeBranches.has(branch)) {
        createdBranches.push(branch);
      }
    }

    snapshot.localBranches = afterBranches;
    snapshot.headName = repository.state.HEAD?.name ?? null;

    if (createdBranches.length > 0) {
      awardXp(repository, createdBranches.length * config.experience.multipliers.gitBranch, GIT_BRANCH_CREATED, {
        branches: createdBranches,
      });
    }
  }

  async function initRepository(repository: GitRepository) {
    await ensureSnapshot(repository);

    const commitSub = repository.onDidCommit(() => {
      void handleCommit(repository);
    });

    const checkoutSub = repository.onDidCheckout(() => {
      void handleCheckout(repository);
    });

    context.subscriptions.push(commitSub, checkoutSub);
  }

  const handleTerminalShellExecutionEnd = async (event: vscode.TerminalShellExecutionEndEvent) => {
    if (event.exitCode !== 0) {
      return;
    }

    const commandLine = event.execution.commandLine.value.trim();

    if (!/^git\s+/i.test(commandLine)) {
      return;
    }

    const repo = git.repositories.find((repository) =>
      event.execution.cwd?.toString().startsWith(repository.rootUri.toString()),
    );

    if (!repo) {
      return;
    }

    if (/^git\s+commit\b/i.test(commandLine)) {
      await handleCommit(repo);
      return;
    }

    if (
      /^git\s+(checkout\s+-b|switch\s+-c|branch\b)/i.test(commandLine)
    ) {
      await handleCheckout(repo);
      return;
    }

    if (/^git\s+merge\b/i.test(commandLine)) {
      // si termina en commit de merge, handleCommit ya sumará commit + merge
      await handleCommit(repo);
    }
  };

  async function load() {
    try {
      git = await requireGitApi();

      for (const repository of git.repositories) {
        await initRepository(repository);
      }

      const repositoryOpenSub = git.onDidOpenRepository((repository) => {
        void initRepository(repository)
          .catch((err) => {
            logger.error(`[TRACKING - REPOSITORY] Error initialising repository: ${(err as Error).message}`);
          });
      });

      gitAPIDisposable = vscode.Disposable.from(
        repositoryOpenSub,
      );

    } catch (error) {
      logger.error(`[TRACKING - REPOSITORY] Error loading Git API. ${(error as Error).message}`);
      return;
    }
  }

  void load();

  const lazyDisposer = new vscode.Disposable(() => gitAPIDisposable?.dispose());

  const terminalShellExecutionSub = vscode.window.onDidEndTerminalShellExecution(async (event) => {
    void handleTerminalShellExecutionEnd(event).catch((err) => {
      logger.error(`[TRACKING - REPOSITORY] Error handling terminal shell execution end: ${(err as Error).message}`);
    });
  });


  const disposable = vscode.Disposable.from(
    lazyDisposer,
    terminalShellExecutionSub,
  );

  context.subscriptions.push(disposable);

  return disposable;
};