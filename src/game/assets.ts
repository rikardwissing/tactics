const titleBackdrop = new URL('../assets/game/backdrops/title-backdrop.png', import.meta.url).href;
const theOrderHouseMarshal = new URL('../assets/game/units/the-order-house-marshal.png', import.meta.url).href;
const theOrderSquireOperative = new URL('../assets/game/units/the-order-squire-operative.png', import.meta.url).href;
const theOrderBannerSurgeon = new URL('../assets/game/units/the-order-banner-surgeon.png', import.meta.url).href;
const myrmidonsTideLegionary = new URL('../assets/game/units/myrmidons-tide-legionary.png', import.meta.url).href;
const myrmidonsHunter = new URL('../assets/game/units/myrmidons-hunter.png', import.meta.url).href;
const myrmidonsSpectre = new URL('../assets/game/units/myrmidons-spectre.png', import.meta.url).href;
const timeTravelersAionTrooper = new URL('../assets/game/units/time-travelers-aion-trooper.png', import.meta.url).href;
const childrenOfTheProphecyAevumGuardian = new URL('../assets/game/units/children-of-the-prophecy-aevum-guardian.png', import.meta.url).href;
const factionMottoTimeTravelers = new URL('../assets/game/voices/faction-motto-time-travelers.mp3', import.meta.url).href;
const factionMottoMyrmidons = new URL('../assets/game/voices/faction-motto-myrmidons.mp3', import.meta.url).href;
const factionMottoTheOrder = new URL('../assets/game/voices/faction-motto-the-order.mp3', import.meta.url).href;
const factionMottoChildrenOfTheProphecy = new URL('../assets/game/voices/faction-motto-children-of-the-prophecy.mp3', import.meta.url).href;
const radiantSlash = new URL('../assets/game/effects/radiant-slash.png', import.meta.url).href;
const skystingArrow = new URL('../assets/game/effects/skysting-arrow.png', import.meta.url).href;
const cinderBurst = new URL('../assets/game/effects/cinder-burst.png', import.meta.url).href;
const graveCleave = new URL('../assets/game/effects/grave-cleave.png', import.meta.url).href;
const blackfeatherShot = new URL('../assets/game/effects/blackfeather-shot.png', import.meta.url).href;
const ashHex = new URL('../assets/game/effects/ash-hex.png', import.meta.url).href;
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

export const DEFAULT_UNIT_IMAGE_KEY = 'the-order-house-marshal' as const;

export const IMAGE_ASSETS = [
  { key: 'title-backdrop', url: titleBackdrop },
  { key: 'the-order-house-marshal', url: theOrderHouseMarshal },
  { key: 'the-order-squire-operative', url: theOrderSquireOperative },
  { key: 'the-order-banner-surgeon', url: theOrderBannerSurgeon },
  { key: 'myrmidons-tide-legionary', url: myrmidonsTideLegionary },
  { key: 'myrmidons-hunter', url: myrmidonsHunter },
  { key: 'myrmidons-spectre', url: myrmidonsSpectre },
  { key: 'time-travelers-aion-trooper', url: timeTravelersAionTrooper },
  { key: 'children-of-the-prophecy-aevum-guardian', url: childrenOfTheProphecyAevumGuardian },
  { key: 'radiant-slash', url: radiantSlash },
  { key: 'skysting-arrow', url: skystingArrow },
  { key: 'cinder-burst', url: cinderBurst },
  { key: 'grave-cleave', url: graveCleave },
  { key: 'blackfeather-shot', url: blackfeatherShot },
  { key: 'ash-hex', url: ashHex },
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
