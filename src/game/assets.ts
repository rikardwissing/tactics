import type { FactionId } from './core/types';

const titleBackdrop = new URL('../assets/game/backdrops/title-backdrop.png', import.meta.url).href;
const setupWarCouncilBackdrop = new URL('../assets/game/backdrops/setup-war-council.png', import.meta.url).href;
const renationsGlobalBackdrop = new URL('../assets/game/backdrops/renations-global-backdrop.png', import.meta.url).href;
const brokenChapelBackdrop = new URL('../assets/game/backdrops/broken-chapel-backdrop.png', import.meta.url).href;
const ashenCausewayBackdrop = new URL('../assets/game/backdrops/ashen-causeway-backdrop.png', import.meta.url).href;
const renationsTacticsLogo = new URL('../assets/game/renations-tactics-logo.png', import.meta.url).href;
const theOrderHouseMarshal = new URL('../assets/game/units/the-order-house-marshal.png', import.meta.url).href;
const theOrderSquireOperative = new URL('../assets/game/units/the-order-squire-operative.png', import.meta.url).href;
const theOrderBannerSurgeon = new URL('../assets/game/units/the-order-banner-surgeon.png', import.meta.url).href;
const myrmidonsTideLegionary = new URL('../assets/game/units/myrmidons-tide-legionary.png', import.meta.url).href;
const myrmidonsHunter = new URL('../assets/game/units/myrmidons-hunter.png', import.meta.url).href;
const myrmidonsSpectre = new URL('../assets/game/units/myrmidons-spectre.png', import.meta.url).href;
const setupPlaceholderUnit = new URL('../assets/game/units/setup-placeholder-unit.png', import.meta.url).href;
const timeTravelersAionTrooper = new URL('../assets/game/units/time-travelers-aion-trooper.png', import.meta.url).href;
const timeTravelersChronomedic = new URL('../assets/game/units/time-travelers-chronomedic.png', import.meta.url).href;
const timeTravelersScavengerMarksman = new URL(
  '../assets/game/units/time-travelers-scavenger-marksman.png',
  import.meta.url
).href;
const childrenOfTheProphecyAevumGuardian = new URL('../assets/game/units/children-of-the-prophecy-aevum-guardian.png', import.meta.url).href;
const childrenOfTheProphecyMirageSeer = new URL(
  '../assets/game/units/children-of-the-prophecy-mirage-seer.png',
  import.meta.url
).href;
const childrenOfTheProphecyMemoryKeeper = new URL(
  '../assets/game/units/children-of-the-prophecy-memory-keeper.png',
  import.meta.url
).href;
const factionMottoTimeTravelers = new URL('../assets/game/voices/faction-motto-time-travelers.mp3', import.meta.url).href;
const factionMottoMyrmidons = new URL('../assets/game/voices/faction-motto-myrmidons.mp3', import.meta.url).href;
const factionMottoTheOrder = new URL('../assets/game/voices/faction-motto-the-order.mp3', import.meta.url).href;
const factionMottoChildrenOfTheProphecy = new URL('../assets/game/voices/faction-motto-children-of-the-prophecy.mp3', import.meta.url).href;
const theOrderBreacherStrike = new URL('../assets/game/effects/the-order-breacher-strike.png', import.meta.url).href;
const theOrderRelayLance = new URL('../assets/game/effects/the-order-relay-lance.png', import.meta.url).href;
const theOrderTracerVolley = new URL('../assets/game/effects/the-order-tracer-volley.png', import.meta.url).href;
const theOrderCauteryCharge = new URL('../assets/game/effects/the-order-cautery-charge.png', import.meta.url).href;
const theOrderFieldMend = new URL('../assets/game/effects/the-order-field-mend.png', import.meta.url).href;
const theOrderStripGear = new URL('../assets/game/effects/the-order-strip-gear.png', import.meta.url).href;
const myrmidonsBreakerCleave = new URL('../assets/game/effects/myrmidons-breaker-cleave.png', import.meta.url).href;
const myrmidonsBrineShot = new URL('../assets/game/effects/myrmidons-brine-shot.png', import.meta.url).href;
const myrmidonsPhaseLash = new URL('../assets/game/effects/myrmidons-phase-lash.png', import.meta.url).href;
const itemMendingSalve = new URL('../assets/game/effects/item-mending-salve.png', import.meta.url).href;
const itemQuickTonic = new URL('../assets/game/effects/item-quick-tonic.png', import.meta.url).href;
const chapelChestClosed = new URL('../assets/game/props/chapel-chest-closed.png', import.meta.url).href;
const chapelChestOpen = new URL('../assets/game/props/chapel-chest-open.png', import.meta.url).href;
const terrainGrassA = new URL('../assets/game/terrain/terrain-grass-a.png', import.meta.url).href;
const terrainGrassB = new URL('../assets/game/terrain/terrain-grass-b.png', import.meta.url).href;
const terrainMossA = new URL('../assets/game/terrain/terrain-moss-a.png', import.meta.url).href;
const terrainMossB = new URL('../assets/game/terrain/terrain-moss-b.png', import.meta.url).href;
const terrainStoneA = new URL('../assets/game/terrain/terrain-stone-a.png', import.meta.url).href;
const terrainStoneB = new URL('../assets/game/terrain/terrain-stone-b.png', import.meta.url).href;
const terrainSanctumA = new URL('../assets/game/terrain/terrain-sanctum-a.png', import.meta.url).href;
const obstacleRubbleBarricade = new URL('../assets/game/props/obstacle-rubble-barricade.png', import.meta.url).href;
const lightTorch = new URL('../assets/game/props/light-torch.png', import.meta.url).href;
const sanctumBrazier = new URL('../assets/game/props/sanctum-brazier.png', import.meta.url).href;

export const DEFAULT_UNIT_IMAGE_KEY = 'time-travelers-aion-trooper' as const;
export const SETUP_PLACEHOLDER_UNIT_IMAGE_KEY = 'setup-slot-placeholder' as const;

export const IMAGE_ASSETS = [
  { key: 'title-backdrop', url: titleBackdrop },
  { key: 'setup-war-council-backdrop', url: setupWarCouncilBackdrop },
  { key: 'renations-global-backdrop', url: renationsGlobalBackdrop },
  { key: 'broken-chapel-backdrop', url: brokenChapelBackdrop },
  { key: 'ashen-causeway-backdrop', url: ashenCausewayBackdrop },
  { key: 'renations-tactics-logo', url: renationsTacticsLogo },
  { key: 'the-order-house-marshal', url: theOrderHouseMarshal },
  { key: 'the-order-squire-operative', url: theOrderSquireOperative },
  { key: 'the-order-banner-surgeon', url: theOrderBannerSurgeon },
  { key: 'myrmidons-tide-legionary', url: myrmidonsTideLegionary },
  { key: 'myrmidons-hunter', url: myrmidonsHunter },
  { key: 'myrmidons-spectre', url: myrmidonsSpectre },
  { key: 'setup-slot-placeholder', url: setupPlaceholderUnit },
  { key: 'time-travelers-aion-trooper', url: timeTravelersAionTrooper },
  { key: 'time-travelers-chronomedic', url: timeTravelersChronomedic },
  { key: 'time-travelers-scavenger-marksman', url: timeTravelersScavengerMarksman },
  { key: 'children-of-the-prophecy-aevum-guardian', url: childrenOfTheProphecyAevumGuardian },
  { key: 'children-of-the-prophecy-mirage-seer', url: childrenOfTheProphecyMirageSeer },
  { key: 'children-of-the-prophecy-memory-keeper', url: childrenOfTheProphecyMemoryKeeper },
  { key: 'the-order-breacher-strike', url: theOrderBreacherStrike },
  { key: 'the-order-relay-lance', url: theOrderRelayLance },
  { key: 'the-order-tracer-volley', url: theOrderTracerVolley },
  { key: 'the-order-cautery-charge', url: theOrderCauteryCharge },
  { key: 'the-order-field-mend', url: theOrderFieldMend },
  { key: 'the-order-strip-gear', url: theOrderStripGear },
  { key: 'myrmidons-breaker-cleave', url: myrmidonsBreakerCleave },
  { key: 'myrmidons-brine-shot', url: myrmidonsBrineShot },
  { key: 'myrmidons-phase-lash', url: myrmidonsPhaseLash },
  { key: 'item-mending-salve', url: itemMendingSalve },
  { key: 'item-quick-tonic', url: itemQuickTonic },
  { key: 'chapel-chest-closed', url: chapelChestClosed },
  { key: 'chapel-chest-open', url: chapelChestOpen },
  { key: 'terrain-grass-a', url: terrainGrassA },
  { key: 'terrain-grass-b', url: terrainGrassB },
  { key: 'terrain-moss-a', url: terrainMossA },
  { key: 'terrain-moss-b', url: terrainMossB },
  { key: 'terrain-stone-a', url: terrainStoneA },
  { key: 'terrain-stone-b', url: terrainStoneB },
  { key: 'terrain-sanctum-a', url: terrainSanctumA },
  { key: 'obstacle-rubble-barricade', url: obstacleRubbleBarricade },
  { key: 'light-torch', url: lightTorch },
  { key: 'sanctum-brazier', url: sanctumBrazier }
] as const;

export const AUDIO_ASSETS = [
  { key: 'faction-motto-time-travelers', url: factionMottoTimeTravelers },
  { key: 'faction-motto-myrmidons', url: factionMottoMyrmidons },
  { key: 'faction-motto-the-order', url: factionMottoTheOrder },
  { key: 'faction-motto-children-of-the-prophecy', url: factionMottoChildrenOfTheProphecy }
] as const;

export const FACTION_MOTTO_AUDIO_KEYS = {
  'time-travelers': 'faction-motto-time-travelers',
  myrmidons: 'faction-motto-myrmidons',
  'the-order': 'faction-motto-the-order',
  'children-of-the-prophecy': 'faction-motto-children-of-the-prophecy'
} satisfies Record<FactionId, (typeof AUDIO_ASSETS)[number]['key']>;
