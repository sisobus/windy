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
- **다음 마일스톤**: v0.5 publish prep 마무리(crates.io 1차 publish + repo public),
  그 후 v1.0 의미론 cut (현재 후보: **F 풍속 + D IP 충돌**).
- **결정 미완**: v1.0의 정확한 의미론 feature 선택. `docs/v1.0-design.md` §
  "Recommendation"이 F+D를 제안 중이지만 사용자 최종 사인 필요.

## 즉시 작업 가능한 항목

다음 세션이 어디서 시작하면 되는지 우선순위 순:

1. **v1.0 의미론 결정 마무리.** `docs/v1.0-design.md` 읽고 사용자에게 F+D 안
   확정/대안 의견 받기. 결정되면 SPEC `## Pre-release: v1.0 (proposal)`
   섹션 초안 작성.
2. **`crates.io` 첫 publish.** 사용자가 `cargo login` 한 번 한 뒤 `cargo
   publish --dry-run` → 실제 publish. Cargo.toml 메타데이터, `cargo package
   --list`(23 files, 33KiB compressed), LICENSE는 모두 준비 완료.
3. **repo public 전환** + README의 `crates.io` 뱃지가 실제 데이터 보이는지
   확인 (publish 후 자동).
4. **빌드 산출물에 진짜 파일명 hash 도입** (지금은 `?v=<sha>` 쿼리스트링).
   진짜 파일명 hash가 immutable cache 헤더 + 영구 캐싱 가능하게 함. v0.6
   이후 미세 최적화.
5. **언어 자체 작업**으로 들어가면 v1.0 design memo의 후보 구현. F (속도)
   + D (충돌)이 가장 가성비 좋은 조합.

작업하기 전에 사용자에게 어느 항목부터 갈지 확인할 것.

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
│   └── conformance.rs     # conformance/cases.json 로더 + 검증
├── conformance/
│   └── cases.json         # 언어 중립 골든 (29 cases 현재)
├── examples/
│   ├── hello.wnd          # 직선 "Hello, World!"
│   ├── hello_winds.wnd    # 2D 루프 라우팅 + sisobus 워터마크
│   ├── fib.wnd            # 첫 10개 피보나치, grid memory(g/p) 활용
│   ├── stars.wnd          # 별 삼각형, stack pre-load + 카운터 루프
│   ├── factorial.wnd      # 1!..10!, BigInt 자랑
│   └── split.wnd          # 동시 IP (`t`) 데모, 두 IP 모두 깨끗하게 halt
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

### v0.5 (배포 채널 확장) — 진행 중

- [x] `wasm32-wasip1` 타겟. CI가 빌드해서 `web/windy.wasm`로 S3 sync.
      `wasmtime --dir=. windy.wasm run hello.wnd` 식으로 실행.
- [x] `wasm-bindgen` cfg를 `target_os="unknown"`으로 좁혀 WASI 빌드에 안 끼게.
- [x] `LICENSE` (MIT) 추가, `Cargo.toml` 메타데이터 정비 (keywords,
      categories, anchored include 리스트). `cargo package --list`로
      깨끗한 23 files / 33KiB 압축 확인.
- [x] README "Why Windy" 섹션 — 풍 메타포 + sisobus + 정직한 dialect
      라벨링 + windy.sisobus.com 링크 + 뱃지.
- [x] `docs/v1.0-design.md` — v1.0 후보 5개 분석 + F+D 추천.
- [x] 캐시버스팅 (`?v=<sha>` + CDN invalidation).
- [ ] **`crates.io` 첫 publish**. 사용자 직접 작업 (cargo login 필요).
- [ ] **repo public 전환** + 뱃지 데이터 노출.

### v1.0 (Befunge dialect 벗어나기) — 미정

후보 분석은 `docs/v1.0-design.md`에. 핵심:

- **A 풍향 관성**: 정체성 정합 최고지만 기존 프로그램이 거의 다 깨짐.
  사실상 reject.
- **B 시간축 grid**: 새 패러다임이지만 grid가 **3D**가 되어 가시성이
  사라짐. 사용자가 "안 보인다"고 거부 의견.
- **C 2D 스택**: 모델 자체 갈아엎음. 너무 큼.
- **D IP 충돌 의미론**: 단독으론 너무 작음.
- **E 다중 토큰 셀**: 1-셀-1-codepoint 약속 깸. reject.

→ 추가 후보 **F 풍속**: 각 IP에 `speed: u32` (기본 1). 새 글리프
`≫` (GUST, `speed += 1`), `≪` (CALM, `speed -= 1`). 풍 메타포 정합 +
2D 가시성 + additive (기본 speed=1이라 v0.x 프로그램 그대로 동작) +
Befunge에 없는 의미론. **Spec cost는 최소** (`IpContext`에 필드 하나
+ opcode 2개).

**현재 추천**: **F + D 같이 v1.0**. 둘 다 additive, 직교, 풍속이
도입한 race 패턴이 충돌 의미론과 자연스럽게 맞물림. 사용자 사인 받고
SPEC에 `## Pre-release: v1.0 (proposal)` 섹션 작성하면 시작.

### v1.x+

SPEC §10 참고. 핑거프린트/opcode 확장 메커니즘, hot-loop tracing JIT,
standard-library overlays.

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
