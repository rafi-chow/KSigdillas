# Netlify credit budget — updated November 4, 2026

The signed-in team is on Free: 300 credits/month, with the displayed billing period October 22–November 21. Two other sites share this allowance. Preserve at least 90 unused credits; the internal ceiling is 210 total team credits.

The dashboard still displayed 300/300 and no credit usage when rechecked November 4 before the modern UI release. Its ledger is delayed: **reserve 120 credits for eight published production releases regardless of that display**. This includes the four original publishes, two for the modern UI (the first was removed after live verification found missing assets), one for the events-button follow-up and one for steak approval. Four further steak upload attempts were canceled before publication and are recorded separately in the release evidence; recheck the actual billing ledger. Deleting a published deploy is not assumed to refund credits. No upgrade, credit pack or payment method was added.

## Evidence and assumptions

Both published functions report 1,024 MB allocation and Node.js 22. Used memory in the native-worker logs was about 124–138 MB; billing uses allocated memory, not used memory. Observed no-work invocations ranged from about 6–150 ms warm and 715–804 ms cold. The final release's automatic full pass persisted its heartbeat at November 3, 10:30 PM Central, with 743 ms application work and 1,520 ms platform duration. Local SQL tests measured 50 synthetic sends in 611 ms and an idle pass in 9 ms. Live payment/email queue throughput is not established by these local numbers.

Public leaderboard JSON measured 3,937 bytes before compression. Its deployed response produced a Netlify Edge cache hit with a 15-second TTL. The modern homepage response measured 49,099 bytes before compression (previously about 69 KB); the earlier static asset baseline was about 1.2 MB uncompressed. Visible pages share one 30-second feed; hidden tabs stop polling and errors back off. Private pages bypass caching.

For a conservative 31-day model, the minute platform trigger makes 44,640 invocations. Seven active days yield 10,080 full passes; the other 24 days yield 2,304 full passes and 32,256 inexpensive no-work invocations. Settled orders receive a daily fallback check, clamped to enter five-minute checking during admission hours; pending payments, provider errors, unresolved refunds and disputes retain faster recovery. Signed provider events are processed independently of that fallback.

## Planning envelope

These are explicit assumptions, not observed event-month totals. The model includes monitoring traffic within the request/foreground-function allowances even though no independent monitor is configured yet.

| Item | Assumption | Credits |
| --- | --- | ---: |
| Production publishing | Eight published releases, 15 each | 120.00 |
| Served bandwidth | 2 GB | 40.00 |
| Web requests | 100,000 across pages, callbacks, polling, schedule and monitor traffic | 20.00 |
| Full maintenance passes | 12,384 × 1 second average × 1 GB allocation | 34.40 |
| No-work schedule invocations | 32,256 × 0.15 seconds average × 1 GB | 13.44 |
| Other function work | 10,000 × 0.5 seconds average × 1 GB | 13.89 |
| Other team projects | Additional allowance; recheck their actual usage | 10.00 |
| **Projected team usage** | | **251.73** |
| **Unused allowance** | 16.1% of 300 | **48.27** |

Rates were checked against [Netlify's credit documentation](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/). **This revised envelope fails the internal 30% reserve**, exceeding the 210-credit ceiling by 41.73 credits even at the assumed one-second full-pass average. At 1.5 seconds average per full pass, projected usage rises to 268.93 credits; at two seconds it reaches 286.13. The observed cold full pass was 1.52 seconds, so the one-second average is unproven. Continuous 18-second passes would exceed the allowance; a timeout bound is not a budget estimate. Reassess actual other-site usage, traffic and runtime before activation, and reduce/remeasure the model before claiming the reserve is satisfied. One extra publish costs 15 credits; an extra GB served costs 20. Avoid routine production publishes and leave at least one rollback/recovery option.

Netlify documents default usage notifications by email and in-app at 50%, 75%, 90% and 100% in its [billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/); the monitoring guide currently lists fewer thresholds. Treat 50% as the first review point. Actual alert delivery has not been triggered/tested, and these billing notices are not independent uptime monitoring.

At 150 credits, review other-site use, response bytes, request counts and function duration. At 210, stop optional publication and unnecessary public polling and investigate the source; preserve paid-order recovery and admissions. The named event operator must own this response before opening sales. Exhaustion can pause every team site; no automatic paid upgrade is authorized.
