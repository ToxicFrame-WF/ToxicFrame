//! tf-scan: research tool. Searches the running Warframe process for a text
//! pattern (read-only) and writes every hit, with context, to scan_results.txt.
//! Output can contain secrets: keep scan_results*.txt local (it is gitignored).

use std::env;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::time::{Duration, Instant};

use toxicframe_helper::memory::Process;
use toxicframe_helper::scan::scan;
use toxicframe_helper::PROCESS_NAME;

const OUTPUT_FILE: &str = "scan_results.txt";
/// Inventory-style JSON anchor used by --watch when no text is given.
const WATCH_DEFAULT: &str = r#""ItemType":"/Lotus/Types/Game/Projections/"#;

struct Options {
    pattern: String,
    utf16: bool,
    context: usize,
    max: usize,
    /// Seconds between scans in watch mode (None = single scan).
    watch: Option<u64>,
    /// Watch mode gives up after this many seconds.
    duration: u64,
    /// Only scan private (heap) memory.
    heap_only: bool,
}

fn main() {
    let Some(opts) = parse_args() else {
        eprintln!("Usage: tf-scan [text] [--utf16] [--context N] [--max N] [--watch [SECS]] [--duration SECS] [--all-memory]");
        eprintln!("  text          text to search for. Default with --watch: {WATCH_DEFAULT}");
        eprintln!("  --utf16       search for the text as UTF-16 instead of UTF-8/ASCII");
        eprintln!("  --context N   bytes of context to save before and after each hit (default 200)");
        eprintln!("  --max N       stop after N hits (default 50)");
        eprintln!("  --watch SECS  rescan every SECS seconds (default 2) until a hit, then save and exit");
        eprintln!("  --duration S  watch mode gives up after S seconds (default 300)");
        eprintln!("  --all-memory  also scan loaded modules and mapped files (default: heap only in watch mode)");
        std::process::exit(2);
    };

    let pattern: Vec<u8> = if opts.utf16 {
        opts.pattern.encode_utf16().flat_map(|u| u.to_le_bytes()).collect()
    } else {
        opts.pattern.as_bytes().to_vec()
    };

    let Some(interval) = opts.watch else {
        let started = Instant::now();
        let Some(hits) = scan_and_save(&opts, &pattern, true) else {
            std::process::exit(1);
        };
        println!(
            "Done in {:.1}s: {} hit(s){}. Results saved to {OUTPUT_FILE}",
            started.elapsed().as_secs_f32(),
            hits,
            if hits >= opts.max { " (stopped at --max)" } else { "" }
        );
        return;
    };

    println!(
        "Watching for \"{}\" every {interval}s for up to {}s. Trigger a loading screen now.",
        opts.pattern, opts.duration
    );
    let started = Instant::now();
    let mut pass = 0;
    while started.elapsed().as_secs() < opts.duration {
        pass += 1;
        let pass_start = Instant::now();
        match scan_and_save(&opts, &pattern, false) {
            Some(0) => println!(
                "Pass {pass} at {:.0}s: no hits ({:.1}s scan)",
                started.elapsed().as_secs_f32(),
                pass_start.elapsed().as_secs_f32()
            ),
            Some(hits) => {
                println!(
                    "Pass {pass} at {:.0}s: {hits} hit(s). Results saved to {OUTPUT_FILE}",
                    started.elapsed().as_secs_f32()
                );
                return;
            }
            None => println!("Pass {pass}: game not readable right now, retrying"),
        }
        std::thread::sleep(Duration::from_secs(interval));
    }
    println!("No hits after {}s.", opts.duration);
    std::process::exit(3);
}

/// Opens the game, scans once, saves snippets if there are hits, closes.
/// Returns the hit count, or None if the game couldn't be opened.
fn scan_and_save(opts: &Options, pattern: &[u8], verbose: bool) -> Option<usize> {
    let process = match Process::open(PROCESS_NAME) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("{e}");
            return None;
        }
    };
    let regions = process.regions(opts.heap_only);
    if verbose {
        let total: usize = regions.iter().map(|r| r.size).sum();
        println!("Found {PROCESS_NAME} (pid {})", process.pid);
        println!(
            "Scanning {} readable regions ({} MB) for \"{}\"{}...",
            regions.len(),
            total / (1024 * 1024),
            opts.pattern,
            if opts.utf16 { " as UTF-16" } else { "" }
        );
    }
    let hits = scan(&process, &regions, pattern, opts.max);
    if verbose || !hits.is_empty() {
        save(opts, pattern, &process, &hits);
    }
    Some(hits.len())
}

fn save(opts: &Options, pattern: &[u8], process: &Process, hits: &[usize]) {
    let file = File::create(OUTPUT_FILE).expect("could not create output file");
    let mut out = BufWriter::new(file);
    writeln!(out, "tf-scan results for \"{}\" (utf16: {})", opts.pattern, opts.utf16).unwrap();
    writeln!(out, "{} hit(s)\n", hits.len()).unwrap();
    for (i, addr) in hits.iter().enumerate() {
        let start = addr.saturating_sub(opts.context);
        let mut buf = vec![0u8; opts.context * 2 + pattern.len()];
        let got = process.read(start, &mut buf);
        writeln!(out, "=== Hit {} at 0x{:X} (offset {} into snippet) ===", i + 1, addr, addr - start).unwrap();
        writeln!(out, "{}\n", printable(&buf[..got])).unwrap();
    }
    out.flush().unwrap();
}

fn parse_args() -> Option<Options> {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut opts = Options {
        pattern: String::new(),
        utf16: false,
        context: 200,
        max: 50,
        watch: None,
        duration: 300,
        heap_only: false,
    };
    let mut all_memory = false;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--utf16" => opts.utf16 = true,
            "--all-memory" => all_memory = true,
            "--watch" => match args.get(i + 1).and_then(|a| a.parse().ok()) {
                Some(secs) => {
                    opts.watch = Some(secs);
                    i += 1;
                }
                None => opts.watch = Some(2),
            },
            "--duration" => {
                i += 1;
                opts.duration = args.get(i)?.parse().ok()?;
            }
            "--context" => {
                i += 1;
                opts.context = args.get(i)?.parse().ok()?;
            }
            "--max" => {
                i += 1;
                opts.max = args.get(i)?.parse().ok()?;
            }
            text => opts.pattern = text.to_string(),
        }
        i += 1;
    }
    if opts.watch.is_some() {
        opts.heap_only = !all_memory;
        if opts.pattern.is_empty() {
            opts.pattern = WATCH_DEFAULT.to_string();
        }
    }
    if opts.pattern.is_empty() { None } else { Some(opts) }
}

/// Shows printable ASCII as-is and everything else as '.'.
fn printable(bytes: &[u8]) -> String {
    bytes.iter().map(|&b| if (0x20..0x7f).contains(&b) { b as char } else { '.' }).collect()
}
