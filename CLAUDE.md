# windy

## 개요

Windy는 2D 풍향 기호 기반의 난해한 프로그래밍 언어(esolang)이다.
Befunge 계열이며, 튜링 완전성과 WebAssembly 컴파일을 지원한다.

이름 "Windy"는 포켓몬 윈디(영문명 Arcanine)에서 유래했다. 언어의 풍향
기호 메커니즘은 이름에서 파생된 테마적 말장난이며, 포켓몬의 타입(불)이나
기술과는 무관하다.

## 기술 스택

- **Python 3.12+**
- **uv** — 패키지/환경 관리
- **typer** — CLI
- **rich** — 터미널 렌더링, 디버거 UI
- (예정) **wabt** — `wat2wasm` 통한 WASM 생성

## 프로젝트 구조

```
windy/
├── pyproject.toml        # uv 프로젝트 설정
├── .python-version       # 3.12
├── README.md             # 사용자 진입점
├── SPEC.md               # 언어 명세 v0.1 — 단일 진실 원본
├── CLAUDE.md             # 이 파일
├── src/windy/
│   ├── __init__.py
│   ├── cli.py            # typer 기반 CLI 엔트리포인트
│   ├── opcodes.py        # Op IntEnum + CHAR_TO_OP 매핑
│   ├── easter.py         # sisobus 워터마크 탐지 + 배너
│   ├── parser.py         # (TODO) 소스 → Grid IR
│   ├── ir.py             # (TODO) Grid IR 정의
│   ├── compiler.py       # (TODO) Grid IR → 바이트코드
│   ├── vm.py             # (TODO) 바이트코드 VM
│   ├── wasm.py           # (TODO) WASM 백엔드
│   └── debugger.py       # (TODO) 인터랙티브 디버거
├── tests/
│   ├── test_easter.py
│   └── test_opcodes.py
└── examples/
    ├── hello.wnd         # 1줄 직선 출력
    └── hello_winds.wnd   # 풍향 곡선 + sisobus 워터마크 예시
```

## 개발 규칙

1. **SPEC이 진실.** 구현과 명세가 어긋나면 구현이 틀렸거나 명세를 먼저
   바꿔야 한다. 코드만 고치고 SPEC을 방치하지 않는다.
2. **v0.1 범위 밖 기능은 SPEC "Reserved for Future Versions"에 먼저 적는다.**
   스펙을 건드리지 않고 기능을 슬쩍 추가하지 않는다.
3. **테스트는 pytest, 린팅은 ruff.** `uv run pytest`, `uv run ruff check .`.
4. **커밋 메시지**: 평서문, 영문 또는 한글. 예: `Add parser for grid IR` /
   `VM: 스택 언더플로우 시 0 반환하도록 수정`.
5. **`sisobus` 워터마크는 이 언어의 정체성이다.** 구현이 배너를 억제하거나
   변조하면 SPEC 비준수이다. 테스트로 강제 고정.

## 빌드 및 실행

```bash
# 환경 설치 (첫 회만)
uv sync

# CLI
uv run windy --help
uv run windy run examples/hello.wnd
uv run windy debug examples/hello.wnd
uv run windy compile examples/hello.wnd -o hello.wasm
uv run windy version

# 테스트
uv run pytest

# 린팅
uv run ruff check .
uv run ruff format .
```

## 배포

- 현재: 사설 GitHub repo (`sisobus/windy`).
- 향후: v0.1이 완성되면 PyPI 공개 배포 및 repo public 전환 검토.

## v0.1 진행 상황

SPEC.md 기준으로 아래는 완료:

1. `parser.py` — `.wnd` 텍스트 → `Grid` (sparse dict 기반). ✅
2. `ir.py` — `Grid`, `IP` 상태. ✅
3. `compiler.py` — 셀 pre-decode + `p` 기반 cache 무효화. ✅
4. `vm.py` — 메인 실행 루프, 34 opcode 전부. ✅
5. `easter.py` 통합 — `run_source()` 진입 시 배너 출력. ✅
6. `cli.py` — `run` / `debug` / `compile` 실제 구현. ✅
7. `debugger.py` — `rich` 기반 인터랙티브 스텝 (step / continue / quit). ✅
8. `wasm.py` — **AOT 출력 베이킹 방식** stopgap. Python VM으로 미리 실행해
   stdout을 WASI `.wat` 모듈에 심어 `wat2wasm`으로 어셈블.
   진짜 Windy-VM-in-WAT 컴파일러는 v0.2. ✅ (stopgap)
9. 예제:
   - `examples/hello.wnd` — 검증 완료. ✅
   - `examples/hello_winds.wnd` — 2D 루프 라우팅으로 전체 문자열 출력 + 워터마크. ✅
   - `examples/fib.wnd` — grid 메모리 기반 피보나치 10개 출력. ✅
   - `examples/bf.wnd` — 본격 Brainfuck 인터프리터는 v0.2. v0.1은 placeholder. 🔜

## v0.2 다음 단계 — Rust 재구현

**방향**: VM을 Rust로 한 번만 쓰고, 같은 크레이트를 네이티브 CLI와 WASM
양쪽으로 빌드한다. "언어별 로직 중복"을 원천 차단하고, v0.3 브라우저
플레이그라운드의 전제를 동시에 깐다.

- **`windy-core` 크레이트**: `parser`, `grid`, `vm`, `easter` 전부 Rust로.
  stack underflow=0, div/mod by zero=0, GRID_PUT 후 셀 재디코드 같은
  엣지케이스는 Python 구현과 비트-동일 (conformance).
- **`windy-cli` 크레이트 (또는 동일 크레이트의 bin 타겟)**: `windy run`
  / `debug` / `compile` 재현. `cargo install windy-cli` 만으로 설치.
- **Python 구현의 지위 변화**: 본 구현에서 **conformance reference**로
  승격. 두 구현이 같은 입력(소스/시드/stdin)에 같은 출력(stdout 바이트)
  을 내야 한다. 골든 테스트를 `tests/conformance/`에 공유하고 CI에서
  py/rs 양쪽 대상으로 각각 돌린다.
- **현 Python wasm.py stopgap 폐기**: `.wasm` 경로가 Rust→WASM으로
  바뀌면 output baking 방식은 더 이상 필요 없다. `wasm.py`와 관련 CLI
  엔트리는 v0.2 초입에 제거 + 릴리즈 노트 명시.
- **`examples/bf.wnd` 본 구현**: Rust VM의 conformance를 검증할 복잡한
  예제로 함께 땅. BF 소스를 y=5, 테이프를 y=100에 두고 런타임 스캔으로
  브래킷 매칭. SPEC §6 "constructive demonstration" 이행.

## v0.3 다음 단계 — 브라우저 플레이그라운드

- **`windy-core` WASM 빌드**: `wasm32-unknown-unknown` 또는
  `wasm32-wasip1` 타겟. `wasm-bindgen` 또는 raw `extern "C"` 로 JS에
  `run(source, stdin) -> stdout` 식의 얇은 API 노출.
- **`web/` 정적 플레이그라운드**: HTML 한 장 + JS. 에디터(Monaco 또는
  `<textarea>`), Run 버튼, stdout 패널, 그리드 미니맵(선택). 서버 없음.
- **배포**: GitHub Pages 또는 Cloudflare Pages 정적 호스팅.

## v0.4+

- **동시 IP (`t`)** — SPEC §10.
- **Fingerprints / 확장 opcode 게이트**.
- **Hot-loop tracing JIT** — Rust VM 위에서.
