//! Read-only access to another process on Windows.
//! Opens with PROCESS_QUERY_INFORMATION | PROCESS_VM_READ only; never writes.

use std::ffi::c_void;
use std::fmt;
use std::mem::{size_of, zeroed};

use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, HANDLE, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::Debug::ReadProcessMemory;
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Memory::{
    VirtualQueryEx, MEMORY_BASIC_INFORMATION, MEM_COMMIT, MEM_PRIVATE, PAGE_GUARD, PAGE_NOACCESS,
};
use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};

#[derive(Debug)]
pub enum OpenError {
    NotRunning,
    AccessDenied,
    Other(u32),
}

impl fmt::Display for OpenError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OpenError::NotRunning => write!(f, "{} is not running", crate::PROCESS_NAME),
            OpenError::AccessDenied => write!(f, "access denied when opening the game (try running as administrator)"),
            OpenError::Other(code) => write!(f, "could not open the game (Windows error {code})"),
        }
    }
}

pub struct Region {
    pub base: usize,
    pub size: usize,
}

/// An open, read-only process handle. Closed on drop.
/// The handle is stored as an integer so the struct is Send + Sync;
/// ReadProcessMemory is safe to call from several threads.
pub struct Process {
    handle: usize,
    pub pid: u32,
}

impl Drop for Process {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.handle as HANDLE) };
    }
}

impl Process {
    pub fn open(name: &str) -> Result<Process, OpenError> {
        let pid = find_pid(name).ok_or(OpenError::NotRunning)?;
        let handle = unsafe { OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid) };
        if handle.is_null() {
            let code = unsafe { GetLastError() };
            return Err(if code == 5 { OpenError::AccessDenied } else { OpenError::Other(code) });
        }
        Ok(Process { handle: handle as usize, pid })
    }

    /// Committed, readable regions. `heap_only` keeps only private memory
    /// (skips loaded modules and mapped files).
    pub fn regions(&self, heap_only: bool) -> Vec<Region> {
        let handle = self.handle as HANDLE;
        let mut regions = Vec::new();
        let mut addr: usize = 0;
        loop {
            let mut info: MEMORY_BASIC_INFORMATION = unsafe { zeroed() };
            let written = unsafe {
                VirtualQueryEx(handle, addr as *const c_void, &mut info, size_of::<MEMORY_BASIC_INFORMATION>())
            };
            if written == 0 {
                break;
            }
            let base = info.BaseAddress as usize;
            let size = info.RegionSize;
            let readable = info.State == MEM_COMMIT
                && info.Protect != 0
                && info.Protect & (PAGE_NOACCESS | PAGE_GUARD) == 0
                && (!heap_only || info.Type == MEM_PRIVATE);
            if readable {
                regions.push(Region { base, size });
            }
            match base.checked_add(size) {
                Some(next) if next > addr => addr = next,
                _ => break,
            }
        }
        regions
    }

    /// Reads as much as possible into buf; returns the number of bytes read.
    pub fn read(&self, addr: usize, buf: &mut [u8]) -> usize {
        let mut read: usize = 0;
        unsafe {
            ReadProcessMemory(
                self.handle as HANDLE,
                addr as *const c_void,
                buf.as_mut_ptr() as *mut c_void,
                buf.len(),
                &mut read,
            );
        }
        read
    }
}

fn find_pid(name: &str) -> Option<u32> {
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE {
            return None;
        }
        let mut entry: PROCESSENTRY32W = zeroed();
        entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
        let mut found = None;
        if Process32FirstW(snap, &mut entry) != 0 {
            loop {
                let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                let exe = String::from_utf16_lossy(&entry.szExeFile[..len]);
                if exe.eq_ignore_ascii_case(name) {
                    found = Some(entry.th32ProcessID);
                    break;
                }
                if Process32NextW(snap, &mut entry) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snap);
        found
    }
}
