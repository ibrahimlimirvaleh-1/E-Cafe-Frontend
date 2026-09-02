# ECafe CI/CD Flow

This repository uses a branch-based deployment flow.

## Branches

- `feature/*`, `bugfix/*`, `hotfix/*`: development branches.
- `dev`: development deployment branch.
- `test`: future test deployment branch.
- `preprod`: future pre-production deployment branch.
- `main`: future production branch.

## Current Deployment

Pushing to `dev` runs `Deploy Frontend Dev`.

The workflow checks out the repository in GitHub Actions, packages the frontend source, uploads that package to the Hetzner server, refreshes `/opt/ecafe/frontend`, builds the frontend container, and restarts the frontend container.

The server does not run `git pull` during deployment. This keeps private repository credentials out of the server and avoids deployment failures caused by missing GitHub credentials on Hetzner.

## Pull Request Flow

Use this flow for normal work:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/my-change
```

After changes:

```bash
git add .
git commit -m "Describe the change"
git push origin feature/my-change
```

Open a pull request:

```text
feature/my-change -> dev
```

The `Frontend CI` workflow checks that dependencies install and the frontend builds. After the PR is merged into `dev`, the dev deployment workflow runs automatically.

## Required GitHub Secrets

For the `dev` environment or repository actions secrets:

```text
ECAFE_DEV_HOST
ECAFE_DEV_USER
ECAFE_DEV_SSH_KEY
ECAFE_DEV_PATH
```

`ECAFE_DEV_SSH_KEY` must be the private SSH key that can connect to the server as `deploy`.

## Future Environments

For `test`, `preprod`, and `prod`, create separate servers or paths and separate GitHub environments. Keep production deployment behind manual approval.
