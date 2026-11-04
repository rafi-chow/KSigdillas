# KSigdillas mobile UI proposals

Three visual directions generated with the built-in image generation tool. These are proposals, not implemented UI or a new deployment. Each board shows a homepage and supply-guide view. Food photography is generated concept imagery, not a photograph of the event or a promise about actual presentation.

## Directions

1. **Quiet confidence** — Apple-inspired minimal hierarchy, white space, burgundy actions, clear product rows. Recommended starting point.
2. **Modern chapter poster** — warm ivory, oxblood and editorial serif typography; strongest continuity with the existing event identity.
3. **After-hours social** — charcoal navigation and prominent food imagery, with a light readable guide.

## Changes common to all three

- Show the complete existing fundraiser logo, with sufficient clear space. Current code scales the artwork to 340% inside an overflow-hidden square; that is the clipping issue seen in the screenshots. Implementation should prepare a correctly bounded asset and render it at its natural aspect ratio rather than masking an enlarged canvas.
- Give ticket purchase and chapter participation separate destinations. Keep the homepage focused on what, when, where and price.
- Replace the mobile four-column supply table with readable product rows, a day selector, and explicit point values and caps. The images show only a sample of the full list.
- Keep important cap/refusal rules visible. Put detailed accepted-product choices, contest rules and supplementary awards behind clearly named links or disclosures, preserving all actual packet rules.
- Remove the duplicated fixed yellow CTA. Any future sticky control must reserve layout space and respect mobile safe areas.
- Use concise labels and short summaries. No copied paragraph dump.
- Preserve actual event details and all-in prices. Concept labels, typography and generated food styling remain subject to implementation review. All time displays should explicitly say Central in the implementation; the shortened mockups omit that qualifier.

## Research

- [Apple iPhone](https://www.apple.com/iphone/): concise feature hierarchy and focused primary/secondary actions.
- [Smorgasburg](https://smorgasburg.com/): a relevant food-event reference for distinct identity and clear event/location destinations.
- [Movember](https://join.movember.com/v2/): relevant fundraising reference and separation of participation choices.
- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): keep common information visible and reveal secondary details on demand.
- [NN/g: Defer Secondary Content for Mobile](https://www.nngroup.com/articles/defer-secondary-content-for-mobile/): prioritize content for mobile readers.

## Files and reproduction

- 01-quiet-confidence.png
- 02-modern-chapter-poster.png
- 03-after-hours-social.png
- prompts.json — exact final prompt set, in the same order.

Identity reference: public/ksigdillas-fundraiser-logo.png. Built-in image generation was used, with this local reference and an opaque background. The original logo file and live website were not modified.
