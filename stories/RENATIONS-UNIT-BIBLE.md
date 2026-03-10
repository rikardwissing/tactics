# Renations Unit Bible

This document defines the phase 1 faction roster, the first playable slice, and the anchor-art references for the Renations retheme.

## First Playable Slice

- Player faction: The Order
- Enemy faction: The Myrmidons
- Current battle implementation: 3 vs 3 infantry-scale roster using renamed unit identities, and all six visible battle units now use approved Renations art
- Latest Myrmidon revisions: `Hunter` uses the approved opaque-silhouette remake, and `Spectre` uses the approved ammo-belt-free remake

Current runtime mapping for the current prototype:

| Runtime unit | Current runtime sprite asset |
| --- | --- |
| The Order House Marshal | `src/assets/game/units/the-order-house-marshal.png` |
| The Order Squire Operative | `src/assets/game/units/the-order-squire-operative.png` |
| The Order Banner Surgeon | `src/assets/game/units/the-order-banner-surgeon.png` |
| The Myrmidons Tide Legionary | `src/assets/game/units/myrmidons-tide-legionary.png` |
| The Myrmidons Hunter | `src/assets/game/units/myrmidons-hunter.png` |
| The Myrmidons Spectre | `src/assets/game/units/myrmidons-spectre.png` |

Approved anchor assets promoted but not yet battle-integrated:

- `src/assets/game/units/time-travelers-aion-trooper.png`
- `src/assets/game/units/children-of-the-prophecy-aevum-guardian.png`
- `src/assets/game/units/time-travelers-scavenger-marksman.png`
- `src/assets/game/units/time-travelers-chronomedic.png`

## Factions

### The Time Travelers

- Anchor unit: `Aion Trooper`
- Motto: `From time's edge, we rebuild.`
- Palette: weathered steel, oxidized teal, faded hazard orange, cold reactor white
- Tech and material language: field-built chrono gear, sealed suits, heavy rifles, relay beacons, segmented armor plates, composite fabric, scavenged instrumentation
- Source art: `art/units/timetravelers-concept.jpg`

| Unit | Role | Silhouette notes | Source art |
| --- | --- | --- | --- |
| Aion Trooper | frontline rifle | sealed helmet, broad shoulder armor, heavy rifle, planted tactical stance | `art/units/timetravelers-concept.jpg` |
| Rift Engineer | controller | compact tech rig, tool-arm silhouette, deployable beacon pack | derived from faction concept |
| Chronomedic | support | medic satchel, reinforced coat, reactor gauntlet | derived from faction concept |
| Scavenger Marksman | ranged | lean marksman frame, long rifle, patched expedition gear | derived from faction concept |
| Paradox Warden | elite | heavier chrono armor, towering reactor core, shielded stance | derived from faction concept |

### The Myrmidons

- Anchor unit: `Hunter`
- Motto: `From the deep, we rise.`
- Palette: sea green, kelp black, brine cyan, rust leather
- Tech and material language: amphibious firearms, bioluminescent harnesses, pressure-forged polearms, mutation chambers, scaled skin, shell-like plating, salt-worn webbing
- Source art: `art/units/myrmidon-concept.jpg`, `art/units/myrmidon-hunter.jpg`, `art/units/myrmidon-spectre.jpg`

| Unit | Role | Silhouette notes | Source art |
| --- | --- | --- | --- |
| Tide Legionary | frontline | broad amphibious infantry frame, polearm profile, plated chest | `art/units/myrmidon-concept.jpg` |
| Hunter | ranged | dual pistols, bandolier, crest silhouette, upright skirmisher stance | `art/units/myrmidon-hunter.jpg` |
| Spectre | controller / assassin | spare humanoid frame, vat-born body language, unsettling calm pose | `art/units/myrmidon-spectre.jpg` |
| Brine Shaper | support | ritual tank rig, tubing, compact aquatic totems | derived from faction concept |
| Reef Champion | elite | denser armor mass, ceremonial weapon, dominant warrior stance | derived from faction concept |

### The Order

- Anchor unit: `House Marshal`
- Motto: `Order through power.`
- Palette: iron black, aged brass, dark wine, parchment ivory
- Tech and material language: relic rifles, sealed bunker armor, command sigils, surgical kit technology, brushed steel, waxed cloth, weathered leather, brass fastenings
- Source art: `art/units/theorder-concept.jpg`, `art/units/theorder-squire.jpg`

| Unit | Role | Silhouette notes | Source art |
| --- | --- | --- | --- |
| House Marshal | frontline | imposing armored officer, command posture, long rifle or polearm profile | `art/units/theorder-concept.jpg` |
| Squire Operative | ranged / utility | lighter hooded figure, compact firearm, grenade and kit straps | `art/units/theorder-squire.jpg` |
| Banner Surgeon | support | field medic banner pack, surgical kit belt, disciplined service silhouette | derived from faction concept |
| Relic Marksman | ranged | precision rifle, rigid noble posture, heavier optics rig | derived from faction concept |
| Palatine Enforcer | elite | dense plate mass, shock baton or hammer profile, heavy authority stance | derived from faction concept |

### The Children of the Prophecy

- Anchor unit: `Aevum Guardian`
- Motto: `We are the guardians of Aevum.`
- Palette: sun-faded sand, bone white, ember red, dusty umber
- Tech and material language: psychic foci, pilgrim polearms, memory relics, meditative field tools, wrapped cloth, worn bone, carved wood, ritual metal fittings
- Source art: `art/units/childrenofprophecy-concept.jpg`

| Unit | Role | Silhouette notes | Source art |
| --- | --- | --- | --- |
| Aevum Guardian | frontline | conical hat, polearm profile, ascetic warrior stance | `art/units/childrenofprophecy-concept.jpg` |
| Mirage Seer | controller | layered veil silhouette, wide sleeves, ritual focus | derived from faction concept |
| Sand Strider | skirmisher | lean runner frame, long stride, curved utility weapon | derived from faction concept |
| Memory Keeper | support | relic satchel, staff or focus bundle, contemplative pose | derived from faction concept |
| Oracle Lancer | elite | taller ceremonial frame, elongated weapon, guardian posture | derived from faction concept |

## Anchor Art Workflow

- Generate anchor candidates only for `Aion Trooper`, `Hunter`, `House Marshal`, and `Aevum Guardian`.
- Keep unapproved prompt specs in `tmp/imagegen/` and image outputs in `output/imagegen/`.
- Do not move any generated candidate into `src/assets/game/` until the user gives an explicit `Approve`.
- Approved anchors are archived in `prompts/imagegen/` and promoted into `src/assets/game/units/`.
