import type { FactionId } from './core/types';

const titleBackdrop = new URL('../assets/game/backdrops/title-backdrop.png', import.meta.url).href;
const setupWarCouncilBackdrop = new URL('../assets/game/backdrops/setup-war-council.png', import.meta.url).href;
const renationsGlobalBackdrop = new URL('../assets/game/backdrops/renations-global-backdrop.png', import.meta.url).href;
const brokenChapelBackdrop = new URL('../assets/game/backdrops/broken-chapel-backdrop.png', import.meta.url).href;
const ashenCausewayBackdrop = new URL('../assets/game/backdrops/ashen-causeway-backdrop.png', import.meta.url).href;
const aionRelayVaultBackdrop = new URL('../assets/game/backdrops/aion-relay-vault-backdrop.png', import.meta.url).href;
const brineCathedralBackdrop = new URL('../assets/game/backdrops/brine-cathedral-backdrop.png', import.meta.url).href;
const ironBasilicaBackdrop = new URL('../assets/game/backdrops/iron-basilica-backdrop.png', import.meta.url).href;
const cloisterOfAevumBackdrop = new URL('../assets/game/backdrops/cloister-of-aevum-backdrop.png', import.meta.url).href;
const battleResultVictory = new URL('../assets/game/ui/battle-result-victory.png', import.meta.url).href;
const battleResultDefeat = new URL('../assets/game/ui/battle-result-defeat.png', import.meta.url).href;
const renationsTacticsLogo = new URL('../assets/game/renations-tactics-logo.png', import.meta.url).href;
const theOrderHouseMarshal = new URL('../assets/game/units/the-order-house-marshal.png', import.meta.url).href;
const theOrderSquireOperative = new URL('../assets/game/units/the-order-squire-operative.png', import.meta.url).href;
const theOrderBannerSurgeon = new URL('../assets/game/units/the-order-banner-surgeon.png', import.meta.url).href;
const myrmidonsTideLegionary = new URL('../assets/game/units/myrmidons-tide-legionary.png', import.meta.url).href;
const myrmidonsHunter = new URL('../assets/game/units/myrmidons-hunter.png', import.meta.url).href;
const myrmidonsSpectre = new URL('../assets/game/units/myrmidons-spectre.png', import.meta.url).href;
const setupPlaceholderUnit = new URL('../assets/game/units/setup-placeholder-unit.png', import.meta.url).href;
const timeTravelersAionTrooper = new URL('../assets/game/units/time-travelers-aion-trooper.png', import.meta.url).href;
const timeTravelersTimeLord = new URL('../assets/game/units/time-travelers-time-lord.png', import.meta.url).href;
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
const unitTurnStartChildrenOfTheProphecyAevumGuardian = new URL(
  '../assets/game/voices/unit-turn-start-children-of-the-prophecy-aevum-guardian.mp3',
  import.meta.url
).href;
const unitTurnStartChildrenOfTheProphecyMirageSeer = new URL(
  '../assets/game/voices/unit-turn-start-children-of-the-prophecy-mirage-seer.mp3',
  import.meta.url
).href;
const unitTurnStartChildrenOfTheProphecyMemoryKeeper = new URL(
  '../assets/game/voices/unit-turn-start-children-of-the-prophecy-memory-keeper.mp3',
  import.meta.url
).href;
const unitTurnStartTimeTravelersAionTrooper = new URL(
  '../assets/game/voices/unit-turn-start-time-travelers-aion-trooper.mp3',
  import.meta.url
).href;
const unitTurnStartTimeTravelersScavengerMarksman = new URL(
  '../assets/game/voices/unit-turn-start-time-travelers-scavenger-marksman.mp3',
  import.meta.url
).href;
const unitTurnStartTimeTravelersChronomedic = new URL(
  '../assets/game/voices/unit-turn-start-time-travelers-chronomedic.mp3',
  import.meta.url
).href;
const unitTurnStartTimeTravelersTimeLord = new URL(
  '../assets/game/voices/unit-turn-start-time-travelers-time-lord.mp3',
  import.meta.url
).href;
const unitTurnStartTheOrderHouseMarshal = new URL(
  '../assets/game/voices/unit-turn-start-the-order-house-marshal.mp3',
  import.meta.url
).href;
const unitTurnStartTheOrderSquireOperative = new URL(
  '../assets/game/voices/unit-turn-start-the-order-squire-operative.mp3',
  import.meta.url
).href;
const unitTurnStartTheOrderBannerSurgeon = new URL(
  '../assets/game/voices/unit-turn-start-the-order-banner-surgeon.mp3',
  import.meta.url
).href;
const unitTurnStartMyrmidonsTideLegionary = new URL(
  '../assets/game/voices/unit-turn-start-myrmidons-tide-legionary.mp3',
  import.meta.url
).href;
const unitTurnStartMyrmidonsHunter = new URL(
  '../assets/game/voices/unit-turn-start-myrmidons-hunter.mp3',
  import.meta.url
).href;
const unitTurnStartMyrmidonsSpectre = new URL(
  '../assets/game/voices/unit-turn-start-myrmidons-spectre.mp3',
  import.meta.url
).href;
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
const terrainChronoA = new URL('../assets/game/terrain/terrain-chrono-a.png', import.meta.url).href;
const terrainChronoB = new URL('../assets/game/terrain/terrain-chrono-b.png', import.meta.url).href;
const terrainBrineA = new URL('../assets/game/terrain/terrain-brine-a.png', import.meta.url).href;
const terrainBrineB = new URL('../assets/game/terrain/terrain-brine-b.png', import.meta.url).href;
const terrainBastionA = new URL('../assets/game/terrain/terrain-bastion-a.png', import.meta.url).href;
const terrainBastionB = new URL('../assets/game/terrain/terrain-bastion-b.png', import.meta.url).href;
const terrainAevumA = new URL('../assets/game/terrain/terrain-aevum-a.png', import.meta.url).href;
const terrainAevumB = new URL('../assets/game/terrain/terrain-aevum-b.png', import.meta.url).href;
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
  { key: 'aion-relay-vault-backdrop', url: aionRelayVaultBackdrop },
  { key: 'brine-cathedral-backdrop', url: brineCathedralBackdrop },
  { key: 'iron-basilica-backdrop', url: ironBasilicaBackdrop },
  { key: 'cloister-of-aevum-backdrop', url: cloisterOfAevumBackdrop },
  { key: 'battle-result-victory', url: battleResultVictory },
  { key: 'battle-result-defeat', url: battleResultDefeat },
  { key: 'renations-tactics-logo', url: renationsTacticsLogo },
  { key: 'the-order-house-marshal', url: theOrderHouseMarshal },
  { key: 'the-order-squire-operative', url: theOrderSquireOperative },
  { key: 'the-order-banner-surgeon', url: theOrderBannerSurgeon },
  { key: 'myrmidons-tide-legionary', url: myrmidonsTideLegionary },
  { key: 'myrmidons-hunter', url: myrmidonsHunter },
  { key: 'myrmidons-spectre', url: myrmidonsSpectre },
  { key: 'setup-slot-placeholder', url: setupPlaceholderUnit },
  { key: 'time-travelers-aion-trooper', url: timeTravelersAionTrooper },
  { key: 'time-travelers-time-lord', url: timeTravelersTimeLord },
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
  { key: 'terrain-chrono-a', url: terrainChronoA },
  { key: 'terrain-chrono-b', url: terrainChronoB },
  { key: 'terrain-brine-a', url: terrainBrineA },
  { key: 'terrain-brine-b', url: terrainBrineB },
  { key: 'terrain-bastion-a', url: terrainBastionA },
  { key: 'terrain-bastion-b', url: terrainBastionB },
  { key: 'terrain-aevum-a', url: terrainAevumA },
  { key: 'terrain-aevum-b', url: terrainAevumB },
  { key: 'obstacle-rubble-barricade', url: obstacleRubbleBarricade },
  { key: 'light-torch', url: lightTorch },
  { key: 'sanctum-brazier', url: sanctumBrazier }
] as const;

export const AUDIO_ASSETS = [
  { key: 'faction-motto-time-travelers', url: factionMottoTimeTravelers },
  { key: 'faction-motto-myrmidons', url: factionMottoMyrmidons },
  { key: 'faction-motto-the-order', url: factionMottoTheOrder },
  { key: 'faction-motto-children-of-the-prophecy', url: factionMottoChildrenOfTheProphecy },
  {
    key: 'unit-turn-start-children-of-the-prophecy-aevum-guardian',
    url: unitTurnStartChildrenOfTheProphecyAevumGuardian
  },
  {
    key: 'unit-turn-start-children-of-the-prophecy-mirage-seer',
    url: unitTurnStartChildrenOfTheProphecyMirageSeer
  },
  {
    key: 'unit-turn-start-children-of-the-prophecy-memory-keeper',
    url: unitTurnStartChildrenOfTheProphecyMemoryKeeper
  },
  { key: 'unit-turn-start-time-travelers-aion-trooper', url: unitTurnStartTimeTravelersAionTrooper },
  {
    key: 'unit-turn-start-time-travelers-scavenger-marksman',
    url: unitTurnStartTimeTravelersScavengerMarksman
  },
  { key: 'unit-turn-start-time-travelers-chronomedic', url: unitTurnStartTimeTravelersChronomedic },
  { key: 'unit-turn-start-time-travelers-time-lord', url: unitTurnStartTimeTravelersTimeLord },
  { key: 'unit-turn-start-the-order-house-marshal', url: unitTurnStartTheOrderHouseMarshal },
  { key: 'unit-turn-start-the-order-squire-operative', url: unitTurnStartTheOrderSquireOperative },
  { key: 'unit-turn-start-the-order-banner-surgeon', url: unitTurnStartTheOrderBannerSurgeon },
  { key: 'unit-turn-start-myrmidons-tide-legionary', url: unitTurnStartMyrmidonsTideLegionary },
  { key: 'unit-turn-start-myrmidons-hunter', url: unitTurnStartMyrmidonsHunter },
  { key: 'unit-turn-start-myrmidons-spectre', url: unitTurnStartMyrmidonsSpectre }
] as const;

export const FACTION_MOTTO_AUDIO_KEYS = {
  'time-travelers': 'faction-motto-time-travelers',
  myrmidons: 'faction-motto-myrmidons',
  'the-order': 'faction-motto-the-order',
  'children-of-the-prophecy': 'faction-motto-children-of-the-prophecy'
} satisfies Record<FactionId, (typeof AUDIO_ASSETS)[number]['key']>;

export const UNIT_TURN_START_AUDIO_KEYS: Partial<Record<string, (typeof AUDIO_ASSETS)[number]['key']>> = {
  'children-of-the-prophecy-aevum-guardian': 'unit-turn-start-children-of-the-prophecy-aevum-guardian',
  'children-of-the-prophecy-mirage-seer': 'unit-turn-start-children-of-the-prophecy-mirage-seer',
  'children-of-the-prophecy-memory-keeper': 'unit-turn-start-children-of-the-prophecy-memory-keeper',
  'time-travelers-aion-trooper': 'unit-turn-start-time-travelers-aion-trooper',
  'time-travelers-scavenger-marksman': 'unit-turn-start-time-travelers-scavenger-marksman',
  'time-travelers-chronomedic': 'unit-turn-start-time-travelers-chronomedic',
  'time-travelers-time-lord': 'unit-turn-start-time-travelers-time-lord',
  'the-order-house-marshal': 'unit-turn-start-the-order-house-marshal',
  'the-order-squire-operative': 'unit-turn-start-the-order-squire-operative',
  'the-order-banner-surgeon': 'unit-turn-start-the-order-banner-surgeon',
  'myrmidons-tide-legionary': 'unit-turn-start-myrmidons-tide-legionary',
  'myrmidons-hunter': 'unit-turn-start-myrmidons-hunter',
  'myrmidons-spectre': 'unit-turn-start-myrmidons-spectre'
};
