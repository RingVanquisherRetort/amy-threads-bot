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
