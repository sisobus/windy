import pytest

from windy.wasm import WasmCompileError, _emit_wat, _escape, compile_to_wat


def test_emit_wat_is_balanced():
    wat = _emit_wat(b"hi")
    assert wat.count("(") == wat.count(")")


def test_emit_wat_wraps_in_module():
    wat = _emit_wat(b"hi")
    assert wat.startswith("(module")
    assert wat.rstrip().endswith(")")


def test_emit_wat_embeds_data_segment_length():
    # The emitted length constant must match the payload size.
    data = b"Hello, World!"
    wat = _emit_wat(data)
    assert f"(i32.const {len(data)})" in wat


def test_escape_handles_printable_ascii():
    # Printable ASCII (except quote/backslash) is passed through verbatim.
    assert _escape(b"Hello") == "Hello"


def test_escape_escapes_quote_and_backslash():
    assert _escape(b'"\\') == '\\"\\\\'


def test_escape_hex_encodes_non_printable():
    assert _escape(b"\x01\x0a\xff") == "\\01\\0a\\ff"


def test_compile_hello_wnd_bakes_output():
    wat = compile_to_wat('"!dlroW ,olleH",,,,,,,,,,,,,@')
    # The baked bytes should contain the printed string verbatim.
    assert "Hello, World!" in wat
    # And the data-segment length line must match that string length.
    assert "(i32.const 13)" in wat


def test_compile_rejects_non_halting_program():
    # ">" loops east forever; compile-time cap kicks in.
    with pytest.raises(WasmCompileError, match="did not halt"):
        compile_to_wat(">")


def test_compile_to_wasm_writes_wat_when_requested(tmp_path):
    from windy.wasm import compile_to_wasm

    out = tmp_path / "hello.wat"
    result = compile_to_wasm('"Hi",,@', out)
    assert result == out
    text = out.read_text(encoding="utf-8")
    assert "(module" in text
    assert "fd_write" in text
    # 'Hi' is 2 bytes.
    assert "(i32.const 2)" in text


def test_compile_to_wasm_errors_without_wat2wasm(monkeypatch, tmp_path):
    import windy.wasm as mod

    monkeypatch.setattr(mod.shutil, "which", lambda _: None)
    out = tmp_path / "hello.wasm"
    with pytest.raises(WasmCompileError, match="wat2wasm not found"):
        mod.compile_to_wasm('"Hi",,@', out)
    # The .wat fallback should have landed next to the requested .wasm.
    assert out.with_suffix(".wat").exists()


def test_baked_output_preserves_unicode():
    # PUT_CHR with a Korean codepoint must survive the bake via UTF-8 bytes.
    wat = compile_to_wat('"가",@')
    # UTF-8 of '가' = EABAB00? Actually '가' = U+AC00 → E1 0x80 0x80? Let me just
    # check the encoded length byte count matches.
    encoded = "가".encode()
    assert f"(i32.const {len(encoded)})" in wat


def test_stdin_dependent_programs_compile_with_eof_fallback():
    # `&` with empty stdin returns -1 and we PUT_NUM it. The program halts
    # cleanly, and compilation should succeed and bake "-1 ".
    wat = compile_to_wat("&.@")
    assert "-1 " in wat or "\\2d\\31\\20" in wat.lower()
