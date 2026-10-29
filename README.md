# Motion Music

An original ink-blue character, Richie, performs six scroll scenes and provides a local, rule-based assistant. Vite + TypeScript; SVG rig; no framework, images, external fonts, API keys, backend, microphone, or speech service.

## Run

```sh
npm install
npm run dev
```

Use Node.js 20.19+ or 22.12+. Open the address printed by Vite. `npm run build` checks TypeScript and creates `dist/`. `npm run preview` serves that production build. This project uses ES modules and needs the local server; it is not a double-click HTML export. The earlier standalone Jaimsee file outside this checkout is unchanged.

## The tour

1. Load: original ink-blue spin, settling squash, welcome, Enter hint.
2. Welcome: anticipation, dash, near-letter stop, recoil, spoken reassurance.
3. About: fall/landing, bone-attached book, three-sentence reading, page turn and closing snap.
4. Portfolio: the same rig enlarged for a close-up, “Go, look around!”, an arcing pullback, three plain cards.
5. Contact: the same body with suit and spring-driven mustard tie. Form validation and “sent” state are local; **no message is sent**. The email address is an intentionally non-deliverable `.example` demo address.
6. Bye: sad brows, eye highlights, one tear, shoulder shiver, shrinking atom.

Scroll backward to scrub the poses. Speech has a separate real-time playhead and finishes across section changes; pending scripted lines take priority over proactive assistance. Idle scene playheads give visitors time to see the beats without precisely scrubbing each frame. Enter is explicit; the page does not scroll itself on load.

## Animation implementation

- `src/rig/skeleton.ts`: one parented hierarchy, including arm and leg segments, folded ear, glasses, three-part note tuft, eyes and mouth. Pose data is `{boneId: {rot,sx,sy,tx,ty}}`.
- `src/clips/`: pose tracks, per-key easing and viewport-relative flight anchors. `src/scenes/director.ts` samples them in either direction.
- `src/physics/`: Catmull–Rom path, underdamped position springs, secondary joint springs, velocity stretch and DOM obstacle avoidance. Occluded anchors are projected into free space. Safety takes precedence over a continuous flight when readable content would be covered.
- Fixed logic/body animation at **24 Hz** with rAF presentation. Ear, tuft, glasses and tie springs are integrated in substeps for stability and interpolated at display refresh rate; body poses are not interpolated. Two brief SVG ghost exposures mark fast transitions.
- `src/rig/visemes.ts`: eight closed paths with 12 matching vertices, morphed over a logic frame. Mouth cues lead speech rhythm by two frames. No voice recording is used: the bubbles and timed cues define the performance, with optional synthesized babble.
- Reduced motion hard-cuts poses and disables flight, stretch, spin, ghosts, springs and lip movement; bubbles, forms and assistant actions still work.

## Change a line

Edit `src/lipsync/lines/<id>.json`: `text`, `duration`, and `cues: [{t, v}]`, with times in seconds. Supported visemes: `rest`, `MBP`, `AA`, `EE`, `OH`, `OO`, `wide`, `grimace`.

Generate a new cue track:

```sh
npm run cues -- "Your new line!"
```

Paste its output into the relevant JSON file and adjust cue timing as desired. `node scripts/cues.mjs --seed` regenerates the shipped lines, replacing hand edits. Runtime assistant replies use `src/lipsync/autoCues.ts`. This is a grapheme rhythm approximation, not measured synchronization to recorded audio.

## Recolor Richie

Change only `src/rig/palette.ts`. All rig, prop and effect colors come from those tokens. The simple page styles live separately in `src/style.css`.

## Assistant rules

Add an object in `src/assistant/rules.ts` with an id, cooldown (at least 20 seconds), trigger and local action. Implement new action kinds in `src/main.ts`’s `execute` function and include an Undo action. `LocalBrain` implements the `AssistantBrain` interface in `src/assistant/brain.ts`; no LLM is connected.

Try these behaviors:

- Stay idle for 8 seconds after a scripted line: “Next one?” plus a Next button. It never scrolls without your click.
- Reverse scroll direction three times within four seconds: section mini-navigation.
- Hover/focus a portfolio card for more than 1.5 seconds: its one-line description.
- Leave an incomplete email field: a pointing prompt. Submit an empty message: the message field receives focus.
- Select page text: a Copy chip. The clipboard is written **only after clicking**; clipboard permission failure is announced. Undo dismisses the offer, not an already completed clipboard write.
- Reload: short welcome back and skipped spin, when localStorage is available.
- On narrow screens: smaller corner placement and an explanatory prompt.

Every proactive offer has Undo/Okay and a per-rule cooldown. Quiet parks Richie small and stops proactive actions. Click Richie or press `/` to ask; Escape closes the dialog. Commands include `go to about`, `read about`, `show work`, `contact`, `copy email`, `quiet`, `sound on/off`, and `help`. Minor single-edit section-name typos are accepted. Unknown input lists the supported commands. No personal data is generated or filled in, and no form submits automatically.

Optional audio starts muted and is enabled only by a user gesture. Visit count is the only persistent value; forms, selections and questions are not saved or transmitted. The page does not fetch runtime assets or services.

## Verification

```sh
npm run build
npm test
```

Tests exercise spring convergence/overshoot, paths and avoidance, mouth topology and cue ordering, rule cooldowns and quiet mode, reversible clip sampling, browser scene transitions, speech continuity, form validation/local submission/undo, mobile placement and copy offers. Screenshots are captured in `/tmp` by the browser tests for visual review.

Playwright uses `/usr/bin/chromium` by default. Set `CHROMIUM_PATH` to a local Chromium executable on another machine. The test server is started automatically or an existing port 5173 server is reused. No browser installation is performed by the app.

## Deploy to Netlify from GitHub

The repository includes the prebuilt `dist/` site. Import `amoceanstudios/amoceanmusic` into Netlify and select `main`. The included `netlify.toml` sets the publish directory to `dist`, leaves the build command empty, and skips dependency installation. No Netlify build command is required.

After changing the TypeScript source locally, run `npm install` and `npm run build`, then commit the updated source **and** `dist/` files. Netlify publishes the committed output after each push. Connecting the repository to your Netlify account still requires your authorization in Netlify.
