# imagegen prompts

This directory stores tracked JSONL prompt specs for generated art that is approved and actually used by the game.

Rules:
- Keep `tmp/imagegen/` for temporary iterations only.
- When a generated asset is approved and promoted into [`src/assets/game`](/Users/rikardwissing/Projects/tactics/src/assets/game), also keep the final approved JSONL spec here.
- Prefer one JSONL file per approved asset family.
- Keep the JSONL runnable with the imagegen CLI when practical.
- Do not preserve every failed prompt iteration here. Keep the final approved recipe.
- Do not put unapproved experiments here.
- Include target render size/readability constraints in the final spec whenever the runtime size is known.

Typical workflow:
1. Iterate in `tmp/imagegen/` and `output/imagegen/`.
2. Show the candidate to the user and get an explicit `Approve` / `Not approve`.
3. Approve a final asset and move it into `src/assets/game/`.
4. Copy the final structured JSONL spec into this directory.
5. Commit the runtime asset and its prompt spec together.
