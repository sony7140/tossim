# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

`study-05`는 상위 `VibeCoding` 워크스페이스의 독립 학습 프로젝트다. 현재 이 폴더에는
애플리케이션 코드가 없고, **소프트웨어 팀을 모사한 5개의 커스텀 서브 에이전트**만
`.claude/agents/`에 정의되어 있다. 즉 이 프로젝트의 핵심 산출물은 "제품을 만드는 팀"
그 자체이며, 실제 제품(예: AI 요약 웹앱)은 이 에이전트들을 통해 이 폴더 안에서 만들어
나가는 것을 전제로 한다.

빌드·린트·테스트 명령은 아직 없다 — 애플리케이션 코드가 추가되기 전까지는 존재하지
않으므로, 임의로 만들어 실행하지 말 것. 코드가 추가되면 그 스택에 맞는 명령을 이 파일에
반영한다.

## 서브 에이전트 팀 (핵심 구조)

`.claude/agents/`의 각 `*.md`는 프론트매터(`name`, `description`, `tools`, `model`)와
한국어 시스템 프롬프트로 된 하나의 전문 에이전트다. `description`은 자동 위임 트리거로
쓰이도록 "언제 이 에이전트를 부르는지"를 예시 문구와 함께 담고 있다.

파이프라인 순서대로:

1. **`prd-manager`** — 프로덕트 매니저. 제품 목표·기능·사용자 요구사항을 정의한 **PRD**를
   작성한다. 코드를 쓰지 않고 기획 문서를 만든다. 기본 산출물 위치는 `docs/PRD.md`.
2. **`backend-developer`** — 서버 아키텍처, REST/GraphQL API, 데이터 모델링, 외부 서비스
   통합, 보안, 성능 최적화. PRD의 인수 조건을 서버 구현으로 옮긴다.
3. **`frontend-developer`** — UI 설계·구현, 반응형, 웹 접근성(a11y), 프런트 성능, API 연동.
4. **`ai-integration-specialist`** — LLM 통합·프롬프트·AI 파이프라인. **이 프로젝트에서는
   OpenRouter API를 통해 OpenAI 모델(`openai/gpt-4o`, `openai/gpt-4o-mini`)과 연동하여
   텍스트 생성·요약을 구현**하는 것이 주 임무다. API 키는 `OPENROUTER_API_KEY` 환경변수로만
   주입한다(하드코딩 금지).
5. **`qa-engineer`** — 기능 테스트, 에러 처리 검증, 성능 확인, 코드 리뷰, 버그 발견·보고,
   사용성 개선 제안. **의도적으로 `Write`/`Edit` 도구가 없는 읽기 전용 진단 역할**이며,
   발견한 이슈의 수정은 해당 개발 에이전트에게 넘긴다.

### 협업 흐름

에이전트들은 서로의 산출물을 이어받도록 `description`이 맞춰져 있다:
**기획(`prd-manager`) → 구현(`backend`/`frontend`/`ai-integration`) → 검증(`qa-engineer`)**,
그리고 QA가 발견한 이슈는 다시 개발 에이전트로 순환한다. AI 기능이 들어가는 작업은
`ai-integration-specialist`가, 나머지 서버/화면은 backend/frontend가 나눠 맡는다.

## 에이전트 정의 수정·추가 시 규칙

이 프로젝트에서 새 에이전트를 만들거나 기존 에이전트를 고칠 때는 기존 5개 파일의 패턴을
따른다:

- **프론트매터**: `name`(kebab-case, 파일명과 일치), `description`(자동 위임용 — "무엇을
  담당하고 어떤 요청일 때 부르는지"를 예시 문구 포함해 서술), 필요한 도구만 담은 `tools`,
  `model: opus`.
- **도구는 역할에 맞게 최소로 준다.** 예: QA는 수정하지 않으므로 `Write`/`Edit`를 빼고,
  외부 스펙 조회가 필요한 backend/ai는 `WebFetch`/`WebSearch`를 포함한다.
- **본문 구조(한국어)**: `# 역할` → `# 작업 원칙` → `# 진행 절차` → 역할별 규격/템플릿
  → `# 산출물 품질 기준(Definition of Done)`. 기존 파일들과 섹션 구성을 일치시킨다.

## 워크스페이스 공통 규칙 (상위 CLAUDE.md 상속)

상위 `VibeCoding/CLAUDE.md`의 규칙이 이 프로젝트에도 적용된다:

- **새 파일 첫 줄은 생성일 주석.** 파일의 주석 문법을 따른다 —
  `# Created: YYYY-MM-DD HH:MM:SS`(Python), `<!-- Created: ... -->`(HTML/Markdown),
  `// Created: ...`(JS). 이 규칙은 에이전트가 생성하는 모든 코드/문서에도 적용한다.
- **한국어가 기본 언어.** UI 텍스트, 코드 주석, 문서 모두 한국어로 작성한다.
- **변경은 `study-05` 안으로 한정.** 다른 `study-NN`과 코드를 공유하지 않는다.
- 환경은 Windows + PowerShell. 상위 워크스페이스는 git 저장소가 아니다.
