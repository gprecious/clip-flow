# Changelog

이 프로젝트의 모든 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

## [0.1.4] - 2026-01-01

### Added
- 홈페이지 진입 시 받아쓰기 모델 상태 자동 체크 및 경고 배너 표시

### Fixed
- Homebrew whisper-cli 바이너리 경로 추가 (배포 앱에서 whisper 인식 안되는 문제 수정)

## [0.1.3] - 2026-01-01

### Added
- 백엔드에 OpenAI 25MB 파일 크기 검증 추가

### Fixed
- 오디오 스트림이 없는 영상에 대한 명확한 에러 메시지 추가

## [0.1.0] - 2024-12-30

### Added
- 미디어 파일 자동 받아쓰기 (whisper.cpp, OpenAI Whisper API)
- AI 요약 기능 (Ollama, OpenAI, Claude)
- 다국어 UI 지원 (한국어, 영어)
- 타임스탬프 포함 구간별 텍스트
- 폴더 기반 미디어 파일 관리
- 시스템 키체인을 통한 안전한 API 키 저장
- 다크/라이트 테마 지원
- 모델 관리자 (다운로드, 삭제, 선택)
- 외부 플레이어로 파일 열기

### Supported Formats
- 영상: MP4, WebM, MOV, AVI, MKV
- 오디오: MP3, WAV, M4A, FLAC, OGG

---

[Unreleased]: https://github.com/flow-finders/clip-flow/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/flow-finders/clip-flow/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/flow-finders/clip-flow/compare/v0.1.0...v0.1.3
[0.1.0]: https://github.com/flow-finders/clip-flow/releases/tag/v0.1.0
