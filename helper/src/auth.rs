//! Finds the session query string the game uses for its own server requests:
//! `?accountId=<24 hex>&nonce=<digits/letters>[&sessionId=<hex>]`.
//!
//! The result is secret. It must never be printed, logged, written to disk,
//! or sent anywhere except mobile.warframe.com. `Secret` has no Debug/Display
//! so it can't be printed by accident.

use crate::memory::Process;
use crate::scan::scan;

pub const NEEDLE: &[u8] = b"?accountId=";
/// Bytes read after each hit; enough for the full query string.
const WINDOW: usize = 320;

/// A session query string. Deliberately has no Debug or Display.
#[derive(PartialEq, Eq)]
pub struct Secret(String);

impl Secret {
    pub fn query(&self) -> &str {
        &self.0
    }
}

/// Scans the game's heap and returns distinct session strings, most frequent first.
pub fn find_candidates(process: &Process, max_hits: usize) -> Vec<Secret> {
    let regions = process.regions(true);
    let hits = scan(process, &regions, NEEDLE, max_hits);
    let mut counts: Vec<(Secret, usize)> = Vec::new();
    let mut buf = vec![0u8; WINDOW];
    for addr in hits {
        let got = process.read(addr, &mut buf);
        if let Some(secret) = parse(&buf[..got]) {
            match counts.iter_mut().find(|(s, _)| *s == secret) {
                Some((_, n)) => *n += 1,
                None => counts.push((secret, 1)),
            }
        }
    }
    // Stable sort keeps memory order for ties.
    counts.sort_by(|a, b| b.1.cmp(&a.1));
    counts.into_iter().map(|(s, _)| s).collect()
}

/// Parses a buffer starting with `?accountId=`. Returns None unless the
/// account ID is exactly 24 hex characters and a non-empty nonce follows.
pub fn parse(bytes: &[u8]) -> Option<Secret> {
    let rest = bytes.strip_prefix(NEEDLE)?;
    let account = take_while(rest, |b| b.is_ascii_hexdigit());
    if account.len() != 24 {
        return None;
    }
    let rest = rest[24..].strip_prefix(b"&nonce=")?;
    let nonce = take_while(rest, |b| b.is_ascii_alphanumeric());
    if nonce.is_empty() {
        return None;
    }
    let mut query = format!("?accountId={}&nonce={}", ascii(account), ascii(nonce));

    // Optional sessionId within the next 200 bytes.
    let after = &rest[nonce.len()..];
    let near = &after[..after.len().min(200)];
    if let Some(pos) = memchr::memmem::find(near, b"&sessionId=") {
        let id = take_while(&near[pos + 11..], |b| b.is_ascii_hexdigit());
        if !id.is_empty() {
            query.push_str("&sessionId=");
            query.push_str(ascii(id));
        }
    }
    Some(Secret(query))
}

fn take_while(bytes: &[u8], f: impl Fn(u8) -> bool) -> &[u8] {
    let end = bytes.iter().position(|&b| !f(b)).unwrap_or(bytes.len());
    &bytes[..end]
}

fn ascii(bytes: &[u8]) -> &str {
    // Only ASCII alphanumerics reach here.
    std::str::from_utf8(bytes).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Fake values only.
    const ACC: &str = "0123456789abcdef01234567";

    #[test]
    fn parses_account_and_nonce() {
        let raw = format!("?accountId={ACC}&nonce=12345&ct=MSI\0junk");
        let s = parse(raw.as_bytes()).unwrap();
        assert_eq!(s.query(), format!("?accountId={ACC}&nonce=12345"));
    }

    #[test]
    fn picks_up_session_id() {
        let raw = format!("?accountId={ACC}&nonce=99&ct=MSI&sessionId=abc123\0");
        let s = parse(raw.as_bytes()).unwrap();
        assert_eq!(s.query(), format!("?accountId={ACC}&nonce=99&sessionId=abc123"));
    }

    #[test]
    fn rejects_wrong_length_and_missing_nonce() {
        assert!(parse(b"?accountId=0123&nonce=1").is_none());
        assert!(parse(format!("?accountId={ACC}&ct=1").as_bytes()).is_none());
        assert!(parse(format!("?accountId={ACC}&nonce=").as_bytes()).is_none());
    }
}
