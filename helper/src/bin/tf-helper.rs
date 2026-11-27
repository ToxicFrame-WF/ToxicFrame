//! tf-helper: reads the game's session string from memory (read-only),
//! requests the inventory from DE's server, and prints the relics as one
//! JSON object on stdout.
//!
//! The session string never leaves this process except in the HTTPS request
//! to mobile.warframe.com. Never print it, and never print raw HTTP errors
//! (they can contain the request URL, which includes the session string).
//!
//! Exit codes: 0 ok, 1 game not running, 2 access denied / open failed,
//! 3 session string not found, 4 server rejected every attempt, 5 network or
//! response error.

use std::io::Read;
use std::process::exit;
use std::time::Duration;

use serde_json::{json, Value};
use toxicframe_helper::auth::{self, Secret};
use toxicframe_helper::memory::{OpenError, Process};
use toxicframe_helper::PROCESS_NAME;

const INVENTORY_URL: &str = "https://mobile.warframe.com/api/inventory.php";
const RELIC_PREFIX: &str = "/Lotus/Types/Game/Projections/";
const MAX_ATTEMPTS: usize = 3;
const MAX_HITS: usize = 200;
const MAX_BODY: u64 = 64 * 1024 * 1024;

/// Top-level inventory sections included in the output under "inventory".
const INVENTORY_SECTIONS: &[&str] = &[
    // Mastery and account
    "DisplayName",
    "PlayerLevel",
    "XPInfo",
    "Missions",
    "PlayerSkills",
    "PlayerIntrinsics",
    "ParadoxIntrinsics",
    "ChallengeProgress",
    // Owned gear
    "Suits",
    "LongGuns",
    "Pistols",
    "Melee",
    "Sentinels",
    "SentinelWeapons",
    "KubrowPets",
    "MoaPets",
    "ZanukaPets",
    "CreaturePets",
    "SpaceSuits",
    "SpaceGuns",
    "SpaceMelee",
    "MechSuits",
    "OperatorAmps",
    "Hoverboards",
    "InfestedFoundry",
    "EvolutionProgress",
    // Mods and arcanes
    "RawUpgrades",
    "Upgrades",
    // Resources, relics, foundry
    "MiscItems",
    "Consumables",
    "Recipes",
    "PendingRecipes",
    // Currencies
    "RegularCredits",
    "PremiumCredits",
    "PremiumCreditsFree",
    "FusionPoints",
    "PrimeTokens",
    // Syndicates
    "Affiliations",
];

fn main() {
    // --summary adds section names and entry counts (no values) for diagnostics.
    let summary = std::env::args().any(|a| a == "--summary");
    // Short attach: open, collect candidates, close before any network work.
    let candidates = {
        let process = match Process::open(PROCESS_NAME) {
            Ok(p) => p,
            Err(e) => fail(if matches!(e, OpenError::NotRunning) { 1 } else { 2 }, &e.to_string()),
        };
        auth::find_candidates(&process, MAX_HITS)
    };
    if candidates.is_empty() {
        fail(3, "session not found in game memory. Log in fully (reach the Orbiter) and try again");
    }

    let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(20)).build();
    let mut last_error = String::new();
    for (i, secret) in candidates.iter().take(MAX_ATTEMPTS).enumerate() {
        match fetch(&agent, secret) {
            Ok(inventory) => {
                let mut out = output(&inventory);
                if summary {
                    out["summary"] = sections_summary(&inventory);
                }
                println!("{out}");
                return;
            }
            Err(Fetch::Rejected(msg)) => last_error = format!("attempt {}: {msg}", i + 1),
            Err(Fetch::Failed(msg)) => fail(5, &msg),
        }
    }
    fail(4, &format!("server rejected the session ({last_error}). Try again after a loading screen"));
}

enum Fetch {
    /// The server answered but didn't accept this session (stale nonce etc.).
    Rejected(String),
    /// Network or parse problem unrelated to the session.
    Failed(String),
}

fn fetch(agent: &ureq::Agent, secret: &Secret) -> Result<Value, Fetch> {
    let url = format!("{INVENTORY_URL}{}", secret.query());
    // Never format the ureq error itself: it can contain the URL.
    let response = match agent.get(&url).call() {
        Ok(r) => r,
        Err(ureq::Error::Status(code, _)) => return Err(Fetch::Rejected(format!("HTTP {code}"))),
        Err(ureq::Error::Transport(t)) => {
            return Err(Fetch::Failed(format!("network error ({:?})", t.kind())));
        }
    };
    let mut body = String::new();
    response
        .into_reader()
        .take(MAX_BODY)
        .read_to_string(&mut body)
        .map_err(|_| Fetch::Failed("could not read the server response".into()))?;
    match serde_json::from_str::<Value>(&body) {
        Ok(v) if v.is_object() && v.get("MiscItems").is_some() => Ok(v),
        // Non-JSON or JSON without inventory fields: treat as a rejected session.
        _ => Err(Fetch::Rejected("response was not an inventory".into())),
    }
}

/// The part of the inventory ToxicFrame uses:
/// {"relics":[{"ItemType","ItemCount"}],
///  "mastery":{"rank":PlayerLevel,"items":[{"ItemType","XP"}]},
///  "inventory":{<raw sections from INVENTORY_SECTIONS>}}
/// `mastery.items` is XPInfo: affinity earned per item, including sold items.
/// Whether an item is mastered is decided in the app (it knows each item's max rank).
fn output(inventory: &Value) -> Value {
    let mut out = relics_output(inventory);
    // Raw sections passed through unchanged (the same set Cephalon Kronos reads).
    // Allow-list on purpose: anything not named here (account details etc.) is dropped.
    let mut raw = serde_json::Map::new();
    for key in INVENTORY_SECTIONS {
        if let Some(v) = inventory.get(*key) {
            raw.insert((*key).to_string(), v.clone());
        }
    }
    out["inventory"] = Value::Object(raw);
    let items: Vec<Value> = inventory["XPInfo"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter(|i| i["ItemType"].is_string())
                .map(|i| json!({ "ItemType": i["ItemType"], "XP": i["XP"] }))
                .collect()
        })
        .unwrap_or_default();
    out["mastery"] = json!({ "rank": inventory["PlayerLevel"], "items": items });
    out
}

/// Keeps only relic entries: {"relics":[{"ItemType":...,"ItemCount":...}]}
fn relics_output(inventory: &Value) -> Value {
    let relics: Vec<Value> = inventory["MiscItems"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter(|item| item["ItemType"].as_str().is_some_and(|t| t.starts_with(RELIC_PREFIX)))
                .map(|item| json!({ "ItemType": item["ItemType"], "ItemCount": item["ItemCount"] }))
                .collect()
        })
        .unwrap_or_default();
    json!({ "relics": relics })
}

/// For each top-level section: its JSON type, entry count if it's a list, and
/// how many entries mention "Projections". Never includes values.
fn sections_summary(inventory: &Value) -> Value {
    let Some(map) = inventory.as_object() else { return json!({}) };
    let mut out = serde_json::Map::new();
    for (key, value) in map {
        let kind = match value {
            Value::Array(_) => "list",
            Value::Object(_) => "object",
            Value::String(_) => "string",
            Value::Number(_) => "number",
            Value::Bool(_) => "bool",
            Value::Null => "null",
        };
        let mut entry = json!({ "type": kind });
        if let Value::Array(items) = value {
            entry["entries"] = json!(items.len());
            let projections = items.iter().filter(|i| i.to_string().contains("Projections")).count();
            if projections > 0 {
                entry["projections"] = json!(projections);
            }
        }
        out.insert(key.clone(), entry);
    }
    Value::Object(out)
}

fn fail(code: i32, msg: &str) -> ! {
    eprintln!("tf-helper: {msg}");
    exit(code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_drops_account_fields_keeps_allowed() {
        let section = INVENTORY_SECTIONS[0];
        let relic = format!("{RELIC_PREFIX}Axi A1");
        let inv = json!({
            "AccountId": {"$oid": "secret"},
            "Email": "a@b.c",
            "PlayerLevel": 7,
            "MiscItems": [
                {"ItemType": relic, "ItemCount": 2, "Extra": 1},
                {"ItemType": "/Lotus/Other", "ItemCount": 9}
            ],
            section: [{"ItemType": "/x"}],
        });
        let out = output(&inv);
        let text = out.to_string();
        for private in ["AccountId", "Email", "a@b.c", "secret"] {
            assert!(!text.contains(private), "leaked {private}");
        }
        assert_eq!(out["relics"].as_array().unwrap().len(), 1);
        assert_eq!(out["relics"][0]["ItemCount"], 2);
        assert!(out["inventory"].get(section).is_some());
        assert_eq!(out["mastery"]["rank"], 7);
    }
}
