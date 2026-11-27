//! Shared code for the ToxicFrame helper binaries.
//! `memory` holds the platform-specific, read-only process access;
//! everything else is platform-independent.

#[cfg(windows)]
#[path = "memory_windows.rs"]
pub mod memory;

#[cfg(not(windows))]
compile_error!("The ToxicFrame helper currently supports Windows only.");

pub mod auth;
pub mod scan;

pub const PROCESS_NAME: &str = "Warframe.x64.exe";
