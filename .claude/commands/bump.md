---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git tag:*), Bash(git push:*), Read, Edit
argument-hint: <major|minor|patch>
description: Semantic versioning으로 버전/태그 올리고 push
---

# Version Bump

프로젝트 버전을 semantic versioning 규칙에 따라 올리고, git tag를 생성하여 push합니다.

## 인자

$ARGUMENTS

- `major`: 호환되지 않는 API 변경 (1.0.0 → 2.0.0)
- `minor`: 하위 호환성 있는 새 기능 추가 (1.0.0 → 1.1.0)
- `patch`: 하위 호환성 있는 버그 수정 (1.0.0 → 1.0.1)

## 현재 버전 정보

- **package.json**: !`grep '"version"' package.json | head -1`
- **Cargo.toml**: !`grep '^version' src-tauri/Cargo.toml | head -1`
- **tauri.conf.json**: !`grep '"version"' src-tauri/tauri.conf.json | head -1`
- **최신 태그**: !`git tag --sort=-v:refname | head -5`

## 현재 Git 상태

- **브랜치**: !`git branch --show-current`
- **상태**: !`git status --short`

## 실행 워크플로우

### 1단계: 사전 검증

다음을 확인합니다:
1. **인자 검증**: major, minor, patch 중 하나인지 확인. 없으면 물어보기
2. **깨끗한 워킹 디렉토리**: 커밋되지 않은 변경사항이 있으면 경고
3. **현재 버전 파싱**: 3개 파일의 버전이 동일한지 확인

### 2단계: 새 버전 계산

Semantic Versioning 규칙:
- 현재 버전: `MAJOR.MINOR.PATCH`
- `patch`: PATCH + 1
- `minor`: MINOR + 1, PATCH = 0
- `major`: MAJOR + 1, MINOR = 0, PATCH = 0

### 3단계: 미리보기 출력

```
=== 버전 업데이트 미리보기 ===

현재 버전: X.Y.Z
새 버전: X.Y.Z (bump_type)

업데이트할 파일:
  - package.json
  - src-tauri/Cargo.toml
  - src-tauri/tauri.conf.json

생성할 태그: vX.Y.Z

진행할까요? [y/n]
```

### 4단계: 버전 업데이트

사용자가 'y'를 선택하면:

1. **파일 수정**: Edit 도구로 3개 파일의 버전 업데이트
   - `package.json`: `"version": "X.Y.Z"`
   - `src-tauri/Cargo.toml`: `version = "X.Y.Z"`
   - `src-tauri/tauri.conf.json`: `"version": "X.Y.Z"`

2. **커밋 생성**:
   ```bash
   git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
   git commit -m "chore: bump version to X.Y.Z"
   ```

3. **태그 생성**:
   ```bash
   git tag vX.Y.Z
   ```

4. **원격 push**:
   ```bash
   git push origin <current-branch>
   git push origin vX.Y.Z
   ```

### 5단계: 완료 요약

```
=== 버전 업데이트 완료 ===

버전: X.Y.Z → X.Y.Z
태그: vX.Y.Z
커밋: <commit-hash>

원격 저장소에 push 완료!
```

## 중요 규칙

- **버전 동기화**: 3개 파일 모두 동일한 버전으로 유지
- **태그 형식**: `v` 접두사 사용 (예: v1.2.3)
- **커밋 메시지**: `chore: bump version to X.Y.Z` 형식 고정
- **force push 금지**: 기존 태그 덮어쓰기 금지
- **사용자 확인 필수**: 자동 실행 전 반드시 확인
