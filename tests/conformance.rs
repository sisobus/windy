//! Conformance harness.
//!
//! Reads `conformance/cases.json` and drives each case through the VM.
//! The JSON format is language-neutral — future implementations (browser
//! JS bundle, etc.) can reuse the same goldens.

use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct Case {
    name: String,
    source: Option<String>,
    source_file: Option<String>,
    #[serde(default)]
    stdin: String,
    seed: Option<u64>,
    max_steps: Option<u64>,
    expected_stdout: String,
    #[serde(default)]
    expected_stderr_contains: Vec<String>,
    #[serde(default)]
    expected_exit: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct Cases {
    cases: Vec<Case>,
}

fn repo_root() -> PathBuf {
    // The crate lives at the repo root after the v0.2 Python retirement.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn load_source(case: &Case) -> String {
    if let Some(s) = &case.source {
        return s.clone();
    }
    let rel = case.source_file.as_ref().expect("case needs source or source_file");
    fs::read_to_string(repo_root().join(rel)).expect("source file readable")
}

#[test]
fn conformance() {
    let json_path = repo_root().join("conformance").join("cases.json");
    let raw = fs::read_to_string(&json_path).expect("cases.json readable");
    let cases: Cases = serde_json::from_str(&raw).expect("cases.json parses");

    let mut failures: Vec<String> = Vec::new();
    for case in &cases.cases {
        let source = load_source(case);
        let mut stdin: &[u8] = case.stdin.as_bytes();
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let code = windy::run_source(
            &source,
            windy::RunOptions {
                seed: case.seed,
                max_steps: case.max_steps,
                v1: false,
                stdin: &mut stdin,
                stdout: &mut stdout,
                stderr: &mut stderr,
            },
        );

        let got_stdout = String::from_utf8(stdout).expect("stdout utf-8");
        let got_stderr = String::from_utf8(stderr).expect("stderr utf-8");
        let expected_exit = case.expected_exit.unwrap_or(0);

        if got_stdout != case.expected_stdout {
            failures.push(format!(
                "[{}] stdout mismatch:\n  expected: {:?}\n  got:      {:?}",
                case.name, case.expected_stdout, got_stdout
            ));
        }
        if code.code() != expected_exit {
            failures.push(format!(
                "[{}] exit mismatch: expected {}, got {}",
                case.name, expected_exit, code.code()
            ));
        }
        for needle in &case.expected_stderr_contains {
            if !got_stderr.contains(needle) {
                failures.push(format!(
                    "[{}] stderr missing {:?}; got {:?}",
                    case.name, needle, got_stderr
                ));
            }
        }
    }

    if !failures.is_empty() {
        panic!("{} conformance failure(s):\n{}", failures.len(), failures.join("\n"));
    }
}
