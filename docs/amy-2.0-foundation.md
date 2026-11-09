# Amy 2.0 Foundation

## Scope
This branch adds an isolated foundation. It does not modify production routes, legacy Redis keys, publishing locks, environment variables, or the current content queue.

## Confirmed editorial settings
- Autonomous topic selection; daily trend discovery; text-first content.
- Four posts/day target; quality takes priority over quota.
- Editorial score threshold: 60/100.
- Posts are intended for automatic publication after editorial validation and a separately approved rollout.
- Comments always require manual approval.
- All Russia with North Caucasus priority: Stavropol first, then Pyatigorsk and Kislovodsk; Makhachkala after checking courier connection availability; other priority cities gradually.
- Trend lookback: three days. Topic repetition window: seven days.
- Intelligent memory retention: 90 days.
- Income-related language is not blanket-blocked. Concrete sums, conditions, and guarantees must not be fabricated.

## Memory domains
1. Content records.
2. Trend records.
3. Performance snapshots.
4. Editorial rules and configuration.
5. Learning insights.
6. Recruitment funnel records.

## Retention and migration safety
- New transient records use the amy2: namespace and a 90-day TTL.
- Persistent editorial configuration is not stored through the TTL helper.
- Existing keys such as draft:*, outreach:*, posted:*, and current queue files are untouched.
- No broad key deletion or automatic migration is included.
- Unavailable metrics remain unknown, not zero.
- Funnel attribution distinguishes confirmed, manual, estimated, and unknown values.

## Rollout boundary
Automatic publishing remains disabled by the existing production safety guard. This branch does not change that guard or deployment environment variables. A later rollout requires testing and separate explicit approval.


## Implemented in the foundation branch

- `lib/amy-content-memory.ts` provides create/update, get, and list operations for content and trend records.
- Content and trend records are stored under separate `amy2:content:` and `amy2:trend:` namespaces.
- Each record receives a 90-day Redis TTL.
- Sorted-set expiry indexes support bounded namespace listing and remove expired index entries during reads.
- Record IDs are validated before being used in Redis keys.
- Scores are validated in the 0..100 range.
- Legacy queue, draft, outreach, and production publishing keys are not read or modified by these APIs.

## Verification status

- Source files were reviewed after writing.
- GitHub branch comparison confirms changes are isolated from `main`.
- Typecheck, lint, and build have not yet been executed in this environment.
- No live Redis write/read test has been performed.
