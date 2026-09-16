# Action-sheet QA contract

Inspect every sheet before deterministic extraction.

## Layout

- Exactly eight full-body poses.
- Four columns by two rows, read left-to-right then top-to-bottom.
- No visible grid, border, label, number, arrow, caption, or watermark.
- Poses remain isolated in their implicit cells and never touch the outer canvas edge.
- The entire background is one flat chroma color.

## Identity

- Same character as `references/canonical.png` in every pose.
- Same face, silhouette, body proportions, markings, palette, clothing, and props.
- Same pixel density, outline treatment, and shading logic.
- No duplicated limbs, disappearing accessories, mirrored identity marks, or unrequested props.

## Motion

- The eight poses form one chronological action, not eight unrelated illustrations.
- Non-looping actions begin near neutral, clearly perform the requested action, and end near neutral.
- Looping actions distribute eight phases around a cycle; pose 8 must connect naturally back to pose 1.
- The character has a stable bottom-center registration unless the storyboard explicitly requires a jump, roll, or travel motion.
- Action categories remain distinguishable. A gift reaction must not look like generic greeting; talking must not look like running; waiting/observing must not look like idle.

## Transparency safety

- No shadows, glow, aura, scenery, floor, detached particles, motion trails, or soft semi-transparent effects.
- Do not use the chroma color inside the character.
- Reject background gradients or key-color spill that crosses the body silhouette.

If identity or motion semantics fail, regenerate the complete sheet. Deterministic extraction can correct size, transparency, and registration; it cannot repair a wrongly drawn action.
