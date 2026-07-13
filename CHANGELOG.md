## 2026-07-13 22:08 - Prepare MVP repository upload

### 变更内容
- `.gitignore`: Expanded ignored files to exclude local environment files, Python caches, Ruff cache, private key/certificate files, build output, dependencies, logs, and generated JSON data.
- `CHANGELOG.md`: Added project change log required before uploading this MVP as a standalone repository.

### 原因
- The remote repository will be overwritten with the local MVP, so sensitive local files and generated artifacts must be excluded before the first commit.

### 影响范围
- Git tracking and repository upload contents only; runtime code and application behavior are unchanged.

## 2026-07-13 22:08 - Tighten environment file ignores

### 变更内容
- `.gitignore`: Changed environment file rules to ignore every `.env.*` file while keeping `.env.example` tracked.

### 原因
- Environment-specific files such as `.env.production` can contain real secrets and must not be uploaded.

### 影响范围
- Git tracking rules only; runtime code and application behavior are unchanged.

## 2026-07-13 22:15 - Update MVP verification count

### 变更内容
- `docs/mvp-implementation-plan.md`: Updated the documented Node test count from 42 to 43 to match the current verified test suite.
- `CHANGELOG.md`: Recorded the documentation correction.

### 原因
- The upload should describe the MVP verification state accurately after the current test run.

### 影响范围
- Documentation only; runtime code and application behavior are unchanged.
