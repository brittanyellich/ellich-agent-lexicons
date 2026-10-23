# Agent workspace lexicons

Draft portable storage vocabulary for AT Protocol Spaces: `at.ellich.agent.*`.
This project is under development. Nothing here has been published or migrated yet.

| Collection | Victrola source | Meaning |
| --- | --- | --- |
| document | ordinary agent_documents | Markdown/plain text document |
| memory | memory_entries | Typed memory with metadata; embeddings remain a local cache |
| session | chat_sessions | Shared conversation identity and title |
| message | chat_messages | One message, authored in its writer's own repository |
| summary | chat_compaction_summaries | Summary with exact covered message URI/CID revisions |
| space | — | Alpha Space declaration recommending these five collections |

`manifest.json` maps logical storage types to NSIDs. Other agents can use the
same vocabulary; compatible alternative namespaces require their own schemas
and DNS delegation. Account identities and Space references belong in local
configuration, never in these schemas or the reusable skill.

## Validation

Node 22+: `npm ci`, `npm test`, `npm run validate`.
The official stable `@atproto/lexicon` validates the five record schemas and
fixtures. It does not support the alpha `space` definition. That declaration's
syntax follows the official `permissioned-data` branch; live alpha validation
and a disposable cross-account Space test remain necessary before migration.
The advertised alpha npm packages currently fail installation with unresolved
`workspace:*` dependencies. Tests do not claim alpha compatibility.

## Publication

The schema publisher does not need a Spaces-enabled account. Delegate the exact
namespace with TXT `_lexicon.agent.ellich.at` = `did=<publisher DID>`.
Publish each JSON document as a public `com.atproto.lexicon.schema` record with
rkey equal to its `id`, adding `$type: com.atproto.lexicon.schema`. Do not rewrite
existing schema semantics after publication; evolve compatibly or mint a new NSID.
Publishing requires its own narrow OAuth grant for that collection; binding
operator grants are unrelated. Verify all six records and DNS independently.
See the [Lexicon specification](https://atproto.com/specs/lexicon).

## Storage contract

Spaces are permission-controlled, not end-to-end encrypted. Create a member-list
read/write Space with an explicit app-access policy. A collection list is a
recommendation, not an enforcement boundary. Keep credentials, MCP tokens,
schedules and operational config local. Never copy legacy `customtool:`,
`mcptoken:`, `mcpserver:` or `schedule:` documents into this store.

Each author writes to their own repository. Resolve identity from the repository
DID, never a message's `role`. Membership grants no authority to overwrite another
member's records. Only trusted runtime components may assign system/tool roles.
Messages point to a canonical session AT URI. `previous` contains causal strong
references; timestamps alone do not define global order. Render concurrent
messages deterministically by timestamp then AT URI without treating that order
as causality.

Summary `covers` enumerates exact message revisions. A changed CID or unseen
concurrent message is not covered. `previousSummary` can chain bounded summaries;
consumers must resolve the full chain, detect cycles, and retain uncovered
messages. Never convert a local integer compaction watermark into a global
watermark. Missing referenced records must not be treated as safely compacted.

Preserve message content strings and distinguish plain text, Markdown and JSON
blocks with `contentFormat`; JSON is data, not executable instructions. `sourceKey`
is optional migration provenance, not a remote record key or trusted identity.
Memory metadata is portable JSON data, not a place for credentials or embeddings.
Bound the full serialized record to the current server limit in the adapter;
individual content fields allow 128 KiB. Reject oversized records without
truncation. Blob/file storage is a separate future extension.

Keep local SQLite/files as the source of truth until cross-account create, read,
update and delete have been verified on disposable data. Migration must be
non-destructive and resumable, with a local-to-remote URI/CID mapping and conflict
detection. No runtime adapter is included yet.

## Publishing helper

Run `node scripts/publish.mjs <publisher DID>` and open
`http://127.0.0.1:8771`. Review the schema files before pressing Publish.
The helper requests create-only schema permission and never overwrites an
existing record. Repeated runs skip byte-equivalent JSON values (object key order
ignored), and stop if a published schema differs. Credentials are memory-only;
close with Ctrl-C to revoke. A forced kill cannot guarantee remote revocation.
Publication is not atomic: inspect all six public records after any failure.
