# Contributing to Clip-Flow

Clip-Flow에 기여해 주셔서 감사합니다! 이 문서는 기여 방법을 안내합니다.

## 개발 환경 설정

### 필수 요구사항

- Node.js 18+
- Rust 1.70+
- FFmpeg
- whisper.cpp (로컬 테스트용)

### 설치

```bash
# 저장소 클론
git clone https://github.com/flow-finders/clip-flow.git
cd clip-flow

# 의존성 설치
npm install

# 개발 서버 실행
npm run tauri dev
```

## 기여 방법

### 1. 이슈 확인

- 기존 이슈를 확인하여 중복을 피해주세요
- 새 기능이나 버그 수정 전에 이슈를 먼저 생성해주세요

### 2. 브랜치 생성

```bash
# 기능 개발
git checkout -b feature/기능명

# 버그 수정
git checkout -b fix/버그명
```

### 3. 코드 작성

#### 코드 스타일

- **TypeScript**: ESLint 규칙 준수
- **Rust**: `cargo fmt` 실행
- **커밋 메시지**: [Conventional Commits](https://www.conventionalcommits.org/) 준수

```bash
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 업데이트
style: 코드 포맷팅
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드, 설정 변경
```

### 4. 테스트

```bash
# 단위 테스트
npm run test

# E2E 테스트
npm run test:e2e

# Rust 테스트
cd src-tauri && cargo test
```

### 5. Pull Request

1. 변경사항을 커밋하고 푸시
2. GitHub에서 Pull Request 생성
3. PR 템플릿을 채워주세요
4. 리뷰를 기다려주세요

## 프로젝트 구조

```
clip-flow/
├── src/                    # React 프론트엔드
│   ├── components/         # UI 컴포넌트
│   │   ├── ui/             # 기본 UI 컴포넌트
│   │   ├── features/       # 기능 컴포넌트
│   │   └── layout/         # 레이아웃 컴포넌트
│   ├── context/            # React Context
│   ├── hooks/              # 커스텀 훅
│   ├── i18n/               # 다국어
│   └── lib/                # 유틸리티
├── src-tauri/              # Rust 백엔드
│   └── src/
│       ├── commands/       # Tauri 명령어
│       └── services/       # 핵심 서비스
└── e2e/                    # E2E 테스트
```

## 테스트 가이드라인

### 프론트엔드 테스트

```typescript
// Tauri 명령어 모킹 필수
vi.mock('@/lib/tauri', () => ({
  someCommand: vi.fn(),
}));

// 테스트 유틸리티 사용
import { render } from '@testing-library/react';
import { AllProviders } from '@/test/test-utils';

render(<MyComponent />, { wrapper: AllProviders });
```

### Rust 테스트

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_something() {
        // 테스트 코드
    }
}
```

## 리뷰 프로세스

1. CI 테스트 통과 확인
2. 코드 리뷰 (최소 1명의 승인 필요)
3. 변경 요청 시 수정 후 재요청
4. 승인 후 머지

## 질문이 있으신가요?

- [GitHub Discussions](https://github.com/flow-finders/clip-flow/discussions)에서 질문해주세요
- 이슈에 `question` 라벨을 붙여 질문할 수도 있습니다

감사합니다!
