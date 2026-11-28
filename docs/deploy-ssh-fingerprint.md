# Deploy SSH Host Fingerprint

## Scope

- Branch: `security/deploy-ssh-fingerprint`, based on updated `origin/dev` at `1d206a8`.
- Existing worktrees are preserved; this worktree has no production environment file.
- [x] Require a canonical OpenSSH SHA256 fingerprint before packaging/upload/SSH.
- [x] Pass the same `ECAFE_DEV_SSH_FINGERPRINT` secret to both pinned Appleboy actions.
- [x] Add offline validator/CLI/workflow regression tests to frontend CI.
- [x] Document safe provisioning and rotation.
- [x] Run/record final local checks: 12 tests passed, including 11 negative workflow mutations.
- [x] Assess disposable connection-test support: not available; local Docker daemon is not running.
- Publication update (November 28, 2026): the user authorized committing and pushing only these five fingerprint-related files to the same remote branch. Deployment, dev merge, live SSH, GitHub secret updates and APK generation remain unauthorized.

## Provision Before Rollout

1. Open the actual server through the hosting provider's authenticated console or another independently trusted administrative channel. Verify the server identity there.
2. In that console, inspect the **host public key** used by SSH, for example:

   ```sh
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
   ```

   Confirm this is an active host key in sshd's configuration. This is not the CI user's authorized key or the deploy private key. Do not copy private key material.
3. Copy only the exact `SHA256:...` field: 43 unpadded base64 characters after the prefix. No leading/trailing spaces, newline, quotes, algorithm label, key size, padding or multiple values. The preflight does not trim. An empty/malformed value fails before any upload rather than disabling verification.
4. In **both** E-Cafe-Frontend and E-Cafe-Backend, populate `Settings > Environments > dev > Environment secrets > ECAFE_DEV_SSH_FINGERPRINT` with that verified fingerprint. Both deploy jobs retain `environment: dev`. Do this before rolling out either workflow.
5. Independently recheck both values through the approved administration process, without printing their contents in job logs. Only after explicit rollout approval, run deployment and inspect the action result. This implementation itself does not perform deployment.

Never establish trust from an unauthenticated `ssh-keyscan` result. A scan may be compared with an already independently verified fingerprint, but is not its source of truth. A well-formed pin for the wrong server must still be rejected by the action's SSH handshake.

## Failure and Rotation

The stdlib validator accepts exactly one canonical 32-byte SHA256 digest, uses only a step-scoped environment variable, emits nothing on success and a generic failure on rejection. It never executes, logs or forwards the value as shell code. Both action inputs receive the same secret independently; validation alone does not authenticate a server.

If the server host key changes, deployment should fail. Stop and investigate through the trusted provider console; do not remove the pin, set an empty value, disable verification or accept the observed network key to recover. Coordinate a maintenance window and replace the verified pin in both repositories' dev environments before an explicitly authorized retry. This contract accepts one key, not a comma-separated rotation list. When multiple host-key algorithms are served, confirm that the pinned key is the one negotiated by both actions; do not weaken validation to hide a mismatch.

Host/user/private-key inputs, action versions, package/extract/build/restart commands and existing workflow permissions are unchanged. Production UI/source dependencies are unchanged. The only new CI dependency is test-time `PyYAML==6.0.3`; the deployed validator needs only Python 3's standard library (available on the Ubuntu runner).

## Checks

```sh
python3 -m pip install PyYAML==6.0.3
python3 -m unittest discover -s scripts -p 'test_deploy_ssh_fingerprint.py' -v
```

Tests use synthetic digests and subprocess environments, not repository or server secrets. They cover missing/blank/whitespace/malformed/Unicode/multiple/noncanonical pins, generic non-leaking CLI output, required ordering before both actions, exact secret wiring, bypass-regression detection and unchanged deployment operations. Workflow YAML is parsed structurally, not matched with a home-grown parser.

Neither offline validation nor workflow parsing proves the third-party action's transport implementation. Record any unavailable disposable SSH/container connection test explicitly before handoff; do not substitute a live-server experiment.

Local verification on November 28, 2026: all 12 tests passed using Python 3.12 and PyYAML 6.0.3. Invalid/blank CLI inputs failed with the same generic message and no input disclosure; valid synthetic pins succeeded silently. Structured workflow checks verified preflight ordering, both exact action versions/inputs and unchanged package/deploy commands. The negative audit rejected 11 deliberately broken wiring/bypass variants. `git diff --check` passed.

The Docker CLI is present but its local Linux-engine named pipe is unavailable. Therefore no correct-pin/wrong-pin real-action connection smoke ran. No host key, deploy key or live server was accessed; no secret was read or changed. A disposable, independently keyed SSH fixture is still recommended for an authorized rollout rehearsal. This is a transport-test limitation, not a reason to skip the preflight or unpin an action.

Verified action input definitions: [scp-action v0.1.7](https://github.com/appleboy/scp-action/blob/v0.1.7/action.yml) and [ssh-action v1.0.3](https://github.com/appleboy/ssh-action/blob/v1.0.3/action.yml).
