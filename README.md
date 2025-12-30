# Clip-Flow

AI 기반 미디어 파일 받아쓰기 및 요약 데스크톱 앱

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## 소개

Clip-Flow는 영상/오디오 파일을 자동으로 받아쓰기(Transcription)하고 요약해주는 데스크톱 앱입니다. 로컬에서 실행되어 프라이버시를 보장하며, 클라우드 API와도 연동할 수 있습니다.

### 주요 기능

- **자동 받아쓰기**: 영상/오디오 파일을 드래그 앤 드롭하면 자동으로 텍스트로 변환
- **AI 요약**: LLM을 활용한 콘텐츠 자동 요약
- **다국어 지원**: 한국어/영어 UI 및 50개 이상의 언어 받아쓰기 지원
- **타임스탬프**: 구간별 텍스트와 시간 정보 제공
- **로컬 우선**: 데이터가 외부로 전송되지 않음 (클라우드 API 사용 시 제외)

## 시스템 요구사항

| 항목 | 요구사항 |
|------|----------|
| OS | macOS 12.0 이상 |
| 메모리 | 8GB 이상 (16GB 권장) |
| 저장공간 | 2GB 이상 (모델 크기에 따라 추가 필요) |

## 초기 설정

### 1. 필수 의존성 설치

#### FFmpeg (필수)

영상에서 오디오를 추출하는 데 사용됩니다.

```bash
# Homebrew로 설치
brew install ffmpeg
```

#### whisper.cpp (로컬 받아쓰기 사용 시)

로컬에서 받아쓰기를 실행하려면 whisper.cpp가 필요합니다.

```bash
# Homebrew로 설치
brew install whisper-cpp
```

또는 앱 내 설정에서 자동 설치할 수 있습니다.

#### Ollama (로컬 LLM 사용 시)

로컬에서 요약 기능을 사용하려면 Ollama가 필요합니다.

```bash
# Homebrew로 설치
brew install ollama

# Ollama 서비스 시작
ollama serve
```

### 2. 앱 실행

```bash
# 개발 모드
npm run tauri dev

# 빌드
npm run tauri build
```

### 3. 모델 다운로드

앱 실행 후 **모델 관리** 메뉴에서:

1. **Whisper 모델** 다운로드 (받아쓰기용)
   - `base`: 빠른 속도, 일반적인 사용에 적합 (추천)
   - `small`: 균형 잡힌 속도와 정확도
   - `medium`: 높은 정확도
   - `large-v3-turbo`: 최고 정확도, 빠른 속도

2. **Ollama 모델** 설치 (요약용)
   ```bash
   ollama pull llama3.2
   ```

## 사용 방법

### 기본 워크플로우

1. 폴더를 선택
2. 자동으로 받아쓰기 시작
3. 완료 후 스크립트/구간별/요약 탭에서 결과 확인
4. 필요 시 외부 플레이어로 열기 가능

### 지원 파일 형식

| 유형 | 형식 |
|------|------|
| 영상 | MP4, WebM, MOV, AVI, MKV |
| 오디오 | MP3, WAV, M4A, FLAC, OGG |

## 받아쓰기 제공자 설정

### 로컬 (whisper.cpp) - 기본값

- 무료
- 인터넷 불필요
- 데이터가 외부로 전송되지 않음
- CPU/GPU 리소스 사용

### OpenAI Whisper API

1. [OpenAI Platform](https://platform.openai.com)에서 API 키 발급
2. 설정 > API 키에서 입력
3. 받아쓰기 제공자를 "클라우드 (OpenAI API)"로 변경

## 요약 제공자 설정

### Ollama (로컬) - 기본값

```bash
# 추천 모델 설치
ollama pull llama3.2        # 빠른 속도
ollama pull qwen2.5:7b      # 한국어 지원 우수
```

### OpenAI / Claude API

1. API 키 발급
   - OpenAI: https://platform.openai.com
   - Claude: https://console.anthropic.com
2. 설정 > API 키에서 입력
3. LLM 제공자 변경

## 주의사항

### 긴 영상 처리

- 1시간 이상의 영상은 처리 시간이 오래 걸릴 수 있습니다
- `base` 모델보다 큰 모델 사용 시 메모리 사용량 증가

### API 키 보안

- API 키는 시스템 키체인에 안전하게 저장됩니다
- 앱 외부로 전송되지 않습니다 (해당 API 서버 제외)

### 언어 설정

- **자동 감지**: Whisper가 자동으로 언어 감지 (기본값)
- **언어 지정**: 정확한 언어를 알 경우 지정하면 정확도 향상

## 개발

### 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, TypeScript, Tailwind CSS |
| 백엔드 | Rust, Tauri v2 |
| 받아쓰기 | whisper.cpp, OpenAI Whisper API |
| 요약 | Ollama, OpenAI GPT, Claude |
| 테스트 | Vitest, Playwright |

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# Rust 의존성 (자동)
cd src-tauri && cargo build

# 개발 서버 실행
npm run tauri dev
```

### 테스트 실행

```bash
# 단위 테스트
npm run test

# E2E 테스트
npm run test:e2e
```

### 프로젝트 구조

```
clip-flow/
├── src/                    # React 프론트엔드
│   ├── components/         # UI 컴포넌트
│   ├── context/            # React Context
│   ├── hooks/              # 커스텀 훅
│   ├── i18n/               # 다국어 파일
│   └── lib/                # 유틸리티
├── src-tauri/              # Rust 백엔드
│   └── src/
│       ├── commands/       # Tauri 명령어
│       └── services/       # 핵심 서비스
├── e2e/                    # E2E 테스트
└── public/                 # 정적 파일
```

## 문제 해결

### whisper.cpp를 찾을 수 없음

```bash
# Homebrew로 설치 확인
which whisper-cpp

# 없으면 설치
brew install whisper-cpp
```

### FFmpeg를 찾을 수 없음

```bash
brew install ffmpeg
```

### Ollama 연결 실패

```bash
# Ollama 실행 확인
curl http://localhost:11434/api/tags

# 실행 안 되어 있으면
ollama serve
```

### 모델 다운로드 실패

- 네트워크 연결 확인
- 저장 공간 확인
- 방화벽 설정 확인

## 라이선스

MIT License

## 후원

개발을 후원해주세요!

- [Buy Me a Coffee](https://buymeacoffee.com/gprecious)
- [GitHub Sponsors](https://github.com/sponsors/gprecious)
