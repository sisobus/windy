# windy

## 개요

Windy는 2D 풍향 기호 기반의 난해한 프로그래밍 언어(esolang)이다.
Befunge 계열이며, 튜링 완전성을 가진다. v0.2부터 구현은 **Rust 단일**로
통일됐다 — 같은 `windy` 크레이트가 네이티브 CLI를 돌리고, v0.3에서 브라우저
플레이그라운드(wasm32 빌드)도 구동한다.

이름 "Windy"는 포켓몬 윈디(영문명 Arcanine)에서 유래했다. 언어의 풍향
기호 메커니즘은 이름에서 파생된 테마적 말장난이며, 포켓몬의 타입(불)이나
기술과는 무관하다.

## 기술 스택

- **Rust 1.75+** (stable), edition 2021
- **clap** (derive) — CLI
- **num-bigint** — 임의 정밀도 스택 값 (SPEC §3.3 요구)
- **rand_chacha** — 결정론적 시드 RNG (SPEC §4.3 `TURBULENCE`)
- **serde / serde_json** (dev) — conformance goldens 로더

## 프로젝트 구조

```
windy/
├── Cargo.toml            # 단일 크레이트 (lib + bin)
├── Cargo.lock
├── src/
│   ├── lib.rs            # 퍼블릭 re-exports
│   ├── main.rs           # clap 기반 CLI (run, version; debug는 v0.2 중반)
│   ├── grid.rs           # Grid (sparse HashMap) + Ip
│   ├── opcodes.rs        # Op enum + decode_cell
│   ├── parser.rs         # BOM/CRLF/shebang 정규화 + grid 빌드
│   ├── easter.rs         # sisobus 워터마크 탐지 + 배너
│   └── vm.rs             # 34 opcode VM, run_source
├── tests/
│   └── conformance.rs    # conformance/cases.json 로더 + 검증
├── conformance/
│   └── cases.json        # 언어 중립 골든 (source/stdin/expected_stdout)
├── examples/
│   ├── hello.wnd
│   ├── hello_winds.wnd
│   ├── fib.wnd
│   └── bf.wnd            # v0.1은 placeholder, v0.2에서 본 구현 예정
├── README.md
├── SPEC.md               # 언어 명세 — 단일 진실 원본
└── CLAUDE.md             # 이 파일
```

## 개발 규칙

1. **SPEC이 진실.** 구현과 명세가 어긋나면 구현이 틀렸거나 명세를 먼저
   바꿔야 한다. 코드만 고치고 SPEC을 방치하지 않는다.
2. **v0.2 범위 밖 기능은 SPEC "Reserved for Future Versions"에 먼저 적는다.**
3. **테스트는 `cargo test`.** 유닛 테스트는 각 모듈의 `#[cfg(test)]`
   블록, 통합 테스트(conformance)는 `tests/conformance.rs`.
4. **커밋 메시지**: 평서문, 영문 또는 한글.
5. **`sisobus` 워터마크는 이 언어의 정체성이다.** 구현이 배너를 억제하거나
   변조하면 SPEC 비준수이다. 테스트로 강제 고정 (`src/easter.rs`,
   `conformance/cases.json`의 `sisobus_banner_fires`).
6. **conformance/cases.json은 언어 중립이어야 한다.** 앞으로 브라우저
   JS 빌드 등 추가 구현이 생기면 같은 파일을 소비하도록 한다. Rust만의
   편의(예: 내부 타입)를 필드로 스며들게 하지 말 것.

## 빌드 및 실행

```bash
# 첫 설치 (rustup이 없으면 먼저)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 빌드 & 실행
cargo build --release
cargo run --release -- run examples/hello.wnd
cargo run --release -- run --seed 42 examples/fib.wnd
cargo run --release -- version

# 또는 PATH에 설치
cargo install --path .
windy run examples/hello.wnd

# 테스트
cargo test                          # 유닛 + conformance 전체
cargo test --test conformance       # conformance만
```

## 배포

- 현재: 사설 GitHub repo (`sisobus/windy`).
- 향후: v0.2 안정화 후 `cargo publish`로 crates.io 공개, repo public 전환.

## v0.2 진행 상황

- [x] Rust 크레이트 스캐폴드, 34 opcode VM, clap CLI (`run` / `version`).
- [x] `conformance/cases.json` + Rust 하네스 — 26 케이스.
- [x] Python 구현 제거, Rust를 루트로 승격.
- [ ] **`debug` 서브커맨드 포팅** — 터미널 기반 스텝 실행 (그리드 뷰포트 +
      IP 커서 + 스택 + stdout 캡처). ANSI 이스케이프만으로 구현, 무거운 TUI
      크레이트 없이.
- [ ] **`examples/bf.wnd` 본 구현** — BF 소스는 y=5, 테이프는 y=100, PC/PTR은
      전용 변수 셀. 런타임 브래킷 매칭(깊이 카운터 + 전/후방 스캔).
      SPEC §6 "constructive demonstration" 이행.

## v0.3 로드맵 — 브라우저 플레이그라운드

- `windy` 크레이트를 `wasm32-unknown-unknown` (또는 `wasm32-wasip1`)으로
  빌드. `wasm-bindgen`으로 JS에 `run(source, stdin) -> {stdout, stderr,
  exit}` 식의 얇은 API 노출.
- `web/` 정적 HTML + JS 플레이그라운드. 에디터(`<textarea>` 또는 Monaco),
  Run/Step, stdout 패널, 그리드 미니맵. 서버 없음.
- 배포는 GitHub Pages 정적 호스팅.

## v0.4+

SPEC §10 참고. 동시 IP(`t`), 핑거프린트/opcode 확장, hot-loop tracing JIT,
standard-library overlays.
