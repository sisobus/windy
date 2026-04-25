# windy

> **Next session: start here.** This file is the canonical project context
> for AI pair-programming. Open `SPEC.md` for language semantics,
> `docs/v1.0-design.md` for the v1.0 design memo. Cards below summarize
> what's done / in-flight / next.

## 한눈에

- **현재 버전**: 크레이트 0.4.0, 언어 SPEC v0.4. 33 opcode + 동시 IP (`t` SPLIT).
- **배포 중**: 브라우저 플레이그라운드 [windy.sisobus.com](https://windy.sisobus.com),
  WASI 바이너리 [windy.sisobus.com/windy.wasm](https://windy.sisobus.com/windy.wasm).
  CI는 `main` push 시 자동 build → S3 sync → CloudFront `/*` invalidate.
- **다음 마일스톤**: **v1.0 cut**. 의미론은 **F 풍속 + D IP 충돌(merge)**
  으로 결정 완료, SPEC에 `## Pre-release: v1.0 (proposal)` 초안 머지됨.
  이제 구현 단계.
- **v0.5 publish는 v1.0 이후로 defer**. crates.io 첫 publish + repo public을
  v0.5 시점에 끊으면 곧바로 v1.0으로 major bump해야 해서 churn이 큼.
  v1.0이 준비되면 그 시점에 publish + public 한 번에 처리.

## 즉시 작업 가능한 항목

v1.0 (proposal) 구현 한 바퀴 다 돌았습니다. 다음 세션 우선순위:

1. **v1.0 stabilize → 정식 cut**.
   - `--v1` 플래그를 default-on으로 뒤집기 + `--v0` legacy 게이트 추가.
   - 크레이트 버전을 `1.0.0`으로 bump, SPEC.md 헤더 v0.4 → v1.0,
     `## Pre-release: v1.0 (proposal)`을 정식 §11 같은 곳으로 이동.
   - 리팩터: README "Why Windy"의 "honest dialect labelling" 문구를
     v1.0 정체성 (속도 + 충돌)으로 갱신.
2. **v1.0 cut 직후, deferred publish 일괄 처리**.
   - `cargo login` (사용자 1회) → `cargo publish --dry-run` →
     `cargo publish`.
   - GitHub repo public 전환. README 뱃지 자동 라이브.
3. **추가 v1.0 케이스 / 데모**:
   - 비대칭 충돌 — 직각 만남으로 살아남는 merge 케이스. 스택 concat
     검증을 stdout으로 끌어내려면 layout 조립이 필요.
   - 디버거에서 merge 이벤트가 일어났을 때 시각적으로 강조 (현재는
     상태 패널의 ips 카운트 변화로만 추론 가능). step-by-step UI 개선.
4. **빌드 산출물에 진짜 파일명 hash 도입** (지금은 `?v=<sha>` 쿼리스트링).
   v1.0 publish 후 미세 최적화.

### 이미 끝난 v1.0 구현 체크리스트 (참고용)

- `Op::Gust`/`Op::Calm` decode + name (`src/opcodes.rs`)
- `IpContext.speed: BigInt`, 기본 1 (`src/vm.rs`)
- `Vm::with_v1` ctor + `pub v1: bool` + `pub trapped: bool`
- `ExitCode::Trap` (134), `Vm::run`이 trap 후 종료
- 이동 단계 v1: `pos += dir * speed`, 도착 셀만 실행
- SPLIT 자식 부모 speed 상속
- GUST/CALM 디스패처 (CALM at 1 = 트랩)
- 충돌 merge pass (birth-order, 스택 concat, 벡터 합 clip, speed max,
  strmode reset, `(0,0)` ⇒ die)
- CLI `--v1`: `windy run --v1` / `windy debug --v1`
- wasm `Session::new(.., v1)`, `run(.., v1)`, getter `session.v1` /
  `session.trapped` / `session.speed_for(i)`
- 75 unit tests (12 v1) + conformance/v1.json (4 cases) +
  `tests/conformance_v1.rs` 하네스 + additivity 테스트 (v0 cases 모두
  v1 모드에서 동일 출력)
- `examples/gust.wnd`, `examples/storm.wnd`
- 플레이그라운드: example picker에 gust/storm 추가 (선택 시 v1 자동
  on), 툴바에 v1 체크박스, Opcode Reference에 ≫/≪ 별도 행, 디버그
  state 패널에 speed/trap 표시, exit 134 → "trap" 라벨

## 개요

Windy는 2D 풍향 기호 기반의 esolang입니다. Befunge-98의 변종이고,
v0.x까지는 의미론적으로 dialect입니다 — Unicode 풍향 글리프 1급 + 강제
sisobus 워터마크 + 임의 정밀도 강제 + sparse-grid 강제가 차별점. v1.0에서
의미론 feature 하나를 도입해 dialect를 벗어날 계획.

이름은 포켓몬 윈디(Arcanine) 한국어 발음에서. 풍향 메커니즘은 이름의
테마적 말장난.

## 기술 스택

- **Rust 1.75+** (stable), edition 2021. 단일 크레이트 (`lib + bin + cdylib`).
- **clap** (derive) — CLI
- **num-bigint / num-integer / num-traits** — 임의 정밀도 스택 + grid
- **rand_chacha** — 결정론적 시드 RNG (TURBULENCE)
- **wasm-bindgen + getrandom[js]** — `wasm32-unknown-unknown` 타겟에서만
  활성화 (`cfg(all(target_arch="wasm32", target_os="unknown"))`).
- **serde + serde_json** (dev) — conformance goldens 로더

## 프로젝트 구조

```
windy/
├── Cargo.toml             # 단일 크레이트 (cdylib + rlib + bin)
├── Cargo.lock
├── LICENSE                # MIT
├── README.md              # "Why Windy" + WASI / 플레이그라운드 안내 + 뱃지
├── SPEC.md                # 언어 명세 — 단일 진실 원본 (v0.4)
├── CLAUDE.md              # 이 파일
├── src/
│   ├── lib.rs             # 퍼블릭 re-exports + wasm_api 게이트
│   ├── main.rs            # clap CLI: run / debug / version
│   ├── grid.rs            # Grid (sparse HashMap) + Ip
│   ├── opcodes.rs         # Op enum + decode_cell
│   ├── parser.rs          # BOM/CRLF/shebang 정규화 + grid 빌드
│   ├── easter.rs          # sisobus 워터마크 + banner() (CARGO_PKG_VERSION 동기화)
│   ├── vm.rs              # multi-IP VM, run_source, all 33 opcode 디스패치
│   ├── debugger.rs        # 터미널 인터랙티브 스텝 (ANSI + 박스 그리기)
│   └── wasm_api.rs        # 브라우저 빌드용 wasm-bindgen 래퍼 (Session 등)
├── tests/
│   ├── conformance.rs     # conformance/cases.json 로더 + 검증 (v0.4)
│   └── conformance_v1.rs  # v1.json 로더 + additivity 가드 (v0 cases도
│                          #   v1 모드에서 동일 출력 보장)
├── conformance/
│   ├── cases.json         # v0.4 언어 중립 골든 (29 cases)
│   └── v1.json            # v1.0 (proposal) 골든 (4 cases — gust skip,
│                          #   gust/calm cycle, calm@1 trap, 2× gust)
├── examples/
│   ├── hello.wnd          # 직선 "Hello, World!"
│   ├── hello_winds.wnd    # 2D 루프 라우팅 + sisobus 워터마크
│   ├── fib.wnd            # 첫 10개 피보나치, grid memory(g/p) 활용
│   ├── stars.wnd          # 별 삼각형, stack pre-load + 카운터 루프
│   ├── factorial.wnd      # 1!..10!, BigInt 자랑
│   ├── split.wnd          # 동시 IP (`t`) 데모, 두 IP 모두 깨끗하게 halt
│   ├── gust.wnd           # v1.0 (proposal): 풍속 (≫/≪) — --v1로 실행
│   └── storm.wnd          # v1.0 (proposal): 충돌 merge head-on death
├── web/                   # 정적 플레이그라운드 (CI가 build해서 S3에 sync)
│   ├── index.html         # 에디터 + Run/Debug + Opcode Reference panel
│   ├── main.js            # ES module, Session API 사용
│   ├── style.css          # 다크/라이트 + 모바일 sticky 디버그 툴바
│   └── README.md          # 빌드/배포 노트
├── docs/
│   └── v1.0-design.md     # v1.0 의미론 후보 분석 + 추천 (F+D)
└── .github/workflows/
    └── deploy.yml         # main push → cargo build (wasm32 두 타겟) → S3 → CF
```

`web/pkg/`와 `target/`은 gitignore. CI에서 wasm-pack가 `web/pkg/`를
생성하고 `cargo build --target wasm32-wasip1 --release`로 `web/windy.wasm`
복사.

## 개발 규칙

1. **SPEC이 진실.** 구현과 명세가 어긋나면 둘 중 하나가 틀린 것 — 반드시
   SPEC도 같이 갱신할 것.
2. **현재 버전 범위 밖 기능은 SPEC §10 "Reserved for Future Versions"에
   먼저 적는다.** v1.0 후보는 §10에 카탈로그 + `docs/v1.0-design.md`에
   상세.
3. **테스트는 `cargo test`.** 유닛 테스트는 `#[cfg(test)]` 블록, 통합은
   `tests/conformance.rs`. 현재 62 unit + 1 conformance(29 cases).
4. **커밋 메시지**는 영문/한글 평서문, body는 명확히. why > what.
5. **`sisobus` 워터마크는 언어의 정체성.** `banner()`이 `CARGO_PKG_VERSION`
   따라 자동 갱신되도록 박혀 있음. 변조/삭제 금지.
6. **conformance/cases.json은 언어 중립.** 향후 다른 구현체(JS 등)가
   생겨도 같은 파일을 소비하도록 Rust 의존 필드 넣지 말 것.
7. **wasm 산출물은 CI가 단일 진실 원본.** 로컬 `wasm-pack build`는
   sanity test 용도(특히 `wasm_api.rs` 변경 시). 커밋된 `web/pkg/`는 없음
   (gitignored).

## 빌드 및 실행

```bash
# 첫 설치
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown wasm32-wasip1   # 웹/WASI 빌드용

# 네이티브 CLI
cargo build --release
cargo run --release -- run examples/hello.wnd
cargo run --release -- debug examples/split.wnd
cargo run --release -- run --seed 42 examples/fib.wnd

# 또는 PATH에 설치
cargo install --path .
windy run examples/hello.wnd

# 브라우저 wasm (web/pkg/ 생성)
wasm-pack build --target web --release --out-dir web/pkg

# WASI 바이너리 (target/wasm32-wasip1/release/windy.wasm)
cargo build --target wasm32-wasip1 --release --bin windy

# 로컬 플레이그라운드
python3 -m http.server -d web 8000   # http://localhost:8000

# 테스트
cargo test                             # 유닛 + conformance 전체
cargo test --test conformance          # conformance만
```

## 배포 / 인프라

- **Repo**: `sisobus/windy` (현재 private, v0.5에서 public 전환 계획)
- **CI**: `.github/workflows/deploy.yml`. main push 또는 workflow_dispatch에
  반응. Rust stable + wasm32-unknown-unknown + wasm32-wasip1 toolchain →
  wasm-pack 0.13.1 → `wasm-pack build --target web` + `cargo build --target
  wasm32-wasip1 --release --bin windy` → `web/windy.wasm` 복사 →
  **`sed -i "s/__VERSION__/$SHORT_SHA/g" web/index.html web/main.js`** 로
  cache-bust 스탬프 → S3 sync (`*.wasm` 제외 → 별도 cp + `application/wasm`
  Content-Type) → CloudFront `/*` invalidation.
- **GitHub secrets**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `AWS_REGION`, `AWS_S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`. (모두 사용자가
  설정.)
- **도메인**: `windy.sisobus.com` (Route53 → CloudFront → S3).
- **Cache-bust 메커니즘**: 정적 자산은 `?v=<short-commit-sha>` 쿼리스트링.
  CI에서 `__VERSION__` 플레이스홀더를 SHA로 치환. index.html은 헤더 없이
  CDN invalidation에 의존 (브라우저 heuristic 캐시 윈도우 짧으니 충분).
  로컬 개발 시 리터럴 `__VERSION__` 그대로(서버가 query 무시).

## 버전별 진행 상황

### v0.1 (Python, 폐기)

Python 인터프리터 + rich 디버거 + WASI output-baking stopgap. v0.2에서
완전히 제거됨.

### v0.2 (Rust 재구현) ✅

- [x] 크레이트 스캐폴드, 33 opcode VM(당시 32에서 v0.4가 1 추가), clap CLI
- [x] `conformance/cases.json` + Rust 하네스
- [x] Python 제거 + Rust 루트 승격
- [x] `debug` 서브커맨드 (터미널 stepper, 무 TUI 크레이트)

### v0.3 (브라우저 플레이그라운드) ✅

- [x] `wasm32-unknown-unknown` 빌드 (cdylib + wasm-bindgen)
- [x] `web/` 정적 플레이그라운드 (HTML/CSS/JS, 다크모드)
- [x] 브라우저 디버거: `Session` API + Debug 모드 (Step/Continue/Restart/
      Exit, 키바인딩, 모바일 sticky 툴바, tap-to-step)
- [x] URL hash permalink (`?s=<base64url>`)
- [x] Opcode Reference panel (collapsible)
- [x] GitHub Actions 자동 배포

### v0.4 (동시 IP) ✅

- [x] SPEC §3.5/§3.6에 multi-IP 모델 명세
- [x] `t` (SPLIT) opcode (§4) — 새 IP를 `(x-dx, y-dy)`에 역방향 스폰, 빈
      스택, strmode off
- [x] VM 리팩터: `Vec<IpContext>`, tick 기반, `@`는 그 IP만 제거
- [x] wasm API 멀티-IP 지원: `ip_count`, `ip_positions()`, `stack_for(i)`,
      `stack_len_for(i)`, `strmode_for(i)`. 디버거가 모든 IP 셀 하이라이트
      + IP별 스택 라벨 섹션 렌더링.
- [x] Conformance 케이스 + Rust 유닛 테스트 다수
- [x] `examples/split.wnd` 추가 — 두 IP 모두 깨끗하게 halt

### v0.5 (배포 채널 확장) — 부분 완료, publish는 v1.0과 합본

- [x] `wasm32-wasip1` 타겟. CI가 빌드해서 `web/windy.wasm`로 S3 sync.
      `wasmtime --dir=. windy.wasm run hello.wnd` 식으로 실행.
- [x] `wasm-bindgen` cfg를 `target_os="unknown"`으로 좁혀 WASI 빌드에 안 끼게.
- [x] `LICENSE` (MIT) 추가, `Cargo.toml` 메타데이터 정비 (keywords,
      categories, anchored include 리스트). `cargo package --list`로
      깨끗한 23 files / 33KiB 압축 확인.
- [x] README "Why Windy" 섹션 — 풍 메타포 + sisobus + 정직한 dialect
      라벨링 + windy.sisobus.com 링크 + 뱃지.
- [x] `docs/v1.0-design.md` — v1.0 후보 5개 분석 + F+D 결정 (post-review).
- [x] 캐시버스팅 (`?v=<sha>` + CDN invalidation).
- [→ v1.0] **`crates.io` 첫 publish**. v0.5 publish 후 곧장 v1.0 major
      bump 따라오면 churn 큼 → v1.0과 같이 publish. 준비 완료 상태로
      대기 (cargo login만 사용자 1회).
- [→ v1.0] **repo public 전환** + 뱃지 데이터 노출. 위와 동일 사유로
      v1.0과 같이 공개.

### v1.0 (Befunge dialect 벗어나기) — 의미론 + 구현 둘 다 완료, --v1 opt-in

**의미론 결정 (post v0.5 review):** **F (풍속) + D (IP 충돌 merge)** 둘 다
채택. 둘 다 additive·직교, 풍속이 만든 race 패턴이 충돌 의미론과 맞물림.
정식 명세는 SPEC § *Pre-release: v1.0 (proposal)*, 결정 사유와 reject된
후보(A 관성 / B 시간축 / C 2D 스택 / E 다중토큰)는 `docs/v1.0-design.md`.

**합의된 디테일** (사용자 사인 받음, 코드에 박힘):

- 풍속은 `BigInt` (upper bound 없음). CALM이 GUST 대칭이라 deceleration
  항상 가능.
- `≪` at speed=1 ⇒ 0 되니 **런타임 트랩** (CALM에 sharp edge 필요).
  `ExitCode::Trap` (134), `Vm.trapped` 플래그로 surface.
- speed=N 의미: 한 tick에 N칸 점프, **도착 셀만 실행**, 중간 셀 스킵
  (string-mode 토글 / unknown-glyph 경고 다 안 일어남).
- `t` SPLIT: 자식이 부모 speed 그대로 상속.
- 충돌 merge: 스택 birth-order concat / 방향 vec sum (axis별 clip,
  `(0,0)` ⇒ die) / speed = max / strmode = false.
- mid-segment 교차(스왑) 검출 안 함. v1.x로 미룸.

**현재 상태**: `--v1` 플래그로 opt-in. 플래그 OFF면 v0.4와 비트-동일
(additivity 테스트가 cases.json 전체를 v1 모드로도 돌려서 동일 출력
확인). 플래그 ON이면 ≫/≪ 활성, 충돌 pass 실행, exit 134 trap 가능.

**남은 v1.0 작업** (§ "즉시 작업 가능한 항목" 1번 참고):

- 정식 cut: `--v1` default-on, crate 1.0.0, SPEC v1.0 헤더 승급, README
  v1.0 정체성 갱신.
- 정식 cut 직후 crates.io publish + repo public.

### v1.x+

SPEC §10 참고. 핑거프린트/opcode 확장 메커니즘, hot-loop tracing JIT,
standard-library overlays. 충돌 mid-segment 검출도 여기.

## 권한 / 작업 환경 메모

- 사용자가 권한 prompt 받기 싫어함. `.claude/settings.local.json`에
  `permissions.defaultMode = "bypassPermissions"` + `skipDangerousModeP
  ermissionPrompt = true`로 박아둠. `/permissions`이 Remote Control에선
  안 열려서 settings watcher가 새 세션에서 자동 로드해야 함.
- 사용자는 가이드 / 결정 위주로 관여. 루틴한 cargo / git / wasm-pack /
  파일 편집은 묻지 말고 진행.
- 응답은 **존댓말**.
- 커밋은 사용자가 명시적으로 커밋 요청하거나 작업 단위가 끝났을 때만.
  자동 push까지 진행 (CI가 배포 처리). submodule 부모 repo
  (`sisobus-workspace`) 포인터 bump도 같이 함.
