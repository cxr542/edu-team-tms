# Journal `live-latest.json` cross-member last-writer-wins analysis

> **Status:** Residual finding — out of scope for PR #5 / #6 / #8.  
> **Do not fix with a small local patch alone.**

## 1. Read/write paths

| Layer | Path | Role |
|-------|------|------|
| API | `api/journal-snapshot.js` | GET/POST on `/api/journal-snapshot` |
| Blob key | `journal/live-latest.json` | Single team-wide snapshot |
| Read | `readLatestSnapshot()` → `readLiveLatestBlob()` → `head` + `fetchBlobJson` | Loads full snapshot |
| Write | `writeLiveBlob()` → Vercel Blob `put` with `allowOverwrite: true` | Replaces entire file |
| Merge | `mergeMemberIntoJournalSnapshot(current, memberCode, journal)` | Updates one member slice inside full snapshot |

Client team-share save: `saveJournalMemberSnapshot` POST → server read full snapshot → merge one member → write full snapshot back.

## 2. How member slices merge

`mergeMemberIntoJournalSnapshot` copies `current.memberJournals` and replaces only `[memberCode]`:

```js
memberJournals: {
  ...current.memberJournals,
  [memberCode]: normalizeMemberJournalSlice(journal),
}
```

Per-member stale detection exists (`isMemberJournalWriteStale`, `memberUpdatedAt`), but **cross-member isolation depends on the `current` snapshot read at POST time being the latest full blob**.

## 3. Repro scenario (logical)

1. Remote blob contains `{ A, B, C }`; B has `memberUpdatedAt[B]=T1`.
2. **B client** reads snapshot S0 at T0.
3. **C client** reads snapshot S0 at T0.
4. **B** edits B slice, POST with `updatedAt=T2` → server reads S0, merges B, writes S1 (B latest, C from S0).
5. **C** edits C slice, POST with stale `updatedAt` from S0 but **passes** if C had no prior remote timestamp, or if C's client timestamp is still "newer" than server's C timestamp while based on stale full snapshot that omitted B's T2 merge.
6. Server reads S1 (or S0 if race on read), merges C, writes S2 — if C's read was S0 and B's write hasn't been seen, **B's slice in the write base can be S0's B**, losing B's T2 edit.

Even when both pass stale checks for their **own** member, the **full-document read-modify-write** can drop another member's concurrent update (classic lost update).

**Conclusion:** Reproducible in theory whenever two members POST without serializing on the same blob revision. Same-member stale 409 does not protect cross-member concurrent writers.

## 4. Minimal test (no Blob write)

Existing unit coverage partially models sequential member saves (`tests/journalCloudSnapshot.test.mjs` — sequential A then B preserves both). That does **not** prove concurrent lost-update safety.

Suggested future test (server-side pure function):

1. Build S0 with B and C slices.
2. Simulate B merge from S0 → S1 (B updated).
3. Simulate C merge still using S0 as base (stale full snapshot) → S2.
4. Assert B slice in S2 equals S0.B, not S1.B → demonstrates cross-member loss.

No production Blob access required.

## 5. Mitigation options

| Approach | Pros | Cons |
|----------|------|------|
| **Storage CAS / ETag / conditional write** | Strong lost-update detection at blob layer | Requires Blob API conditional put support + client retry |
| **Member-sharded blobs** | Each member writes own object; no cross-member overwrite | Migration, merge on read, more keys |
| **Server-side merge before write with revision token** | Single API can reject stale full revision | Needs monotonic revision in snapshot meta |
| **Client retry with conflict detection** | Builds on existing 409 paths | Insufficient alone for cross-member unless full revision checked |

## 6. Recommendation

Track as a **separate design task** after PR #5 / #6 / #8 merge. Do not combine with approval-import or stale-timestamp hotfixes.
