//! Parallel, read-only pattern search over a process's memory.

use std::sync::atomic::{AtomicUsize, Ordering};

use memchr::memmem;

use crate::memory::{Process, Region};

const CHUNK: usize = 4 * 1024 * 1024;

/// Returns the address of every hit (sorted), up to `max`.
/// Regions are spread over the CPU cores; each worker reads with its own buffer.
pub fn scan(process: &Process, regions: &[Region], pattern: &[u8], max: usize) -> Vec<usize> {
    let threads = std::thread::available_parallelism().map_or(4, |n| n.get()).min(16);
    let next = AtomicUsize::new(0);
    let found = AtomicUsize::new(0);

    let mut hits: Vec<usize> = std::thread::scope(|s| {
        let workers: Vec<_> = (0..threads)
            .map(|_| {
                let (next, found) = (&next, &found);
                s.spawn(move || {
                    let finder = memmem::Finder::new(pattern);
                    // Overlap chunks so a hit spanning a chunk border is still found (never twice).
                    let overlap = pattern.len().saturating_sub(1);
                    let mut buf = vec![0u8; CHUNK];
                    let mut hits = Vec::new();
                    loop {
                        let idx = next.fetch_add(1, Ordering::Relaxed);
                        let Some(region) = regions.get(idx) else { break };
                        let mut offset = 0;
                        while offset < region.size {
                            if found.load(Ordering::Relaxed) >= max {
                                return hits;
                            }
                            let want = (region.size - offset).min(CHUNK);
                            let got = process.read(region.base + offset, &mut buf[..want]);
                            for pos in finder.find_iter(&buf[..got]) {
                                hits.push(region.base + offset + pos);
                                found.fetch_add(1, Ordering::Relaxed);
                            }
                            if offset + want >= region.size {
                                break;
                            }
                            offset += if got < want { want } else { want - overlap };
                        }
                    }
                    hits
                })
            })
            .collect();
        workers.into_iter().flat_map(|w| w.join().unwrap()).collect()
    });
    hits.sort_unstable();
    hits.truncate(max);
    hits
}
