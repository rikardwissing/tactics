import { FactionId, FactionProfile } from '../core/types';

export const FACTION_PROFILES: Record<FactionId, FactionProfile> = {
  'time-travelers': {
    id: 'time-travelers',
    displayName: 'The Time Travelers',
    motto: 'From time\'s edge, we rebuild.',
    summary: 'Stranded scientists from the failed Aion jump who rebuild with scavenged future tech and hard-won survival doctrine.',
    palette: ['weathered steel', 'oxidized teal', 'faded hazard orange', 'cold reactor white'],
    techLanguage: 'field-built chrono gear, sealed suits, heavy rifles, relay beacons',
    materialLanguage: 'segmented armor plates, reactor housings, composite fabric, scavenged instrumentation',
    sourceArtPaths: ['art/units/timetravelers-concept.jpg']
  },
  myrmidons: {
    id: 'myrmidons',
    displayName: 'The Myrmidons',
    motto: 'From the deep, we rise.',
    summary: 'Deep-ocean descendants adapted beyond baseline humanity, armed with amphibious weapons, ritual warforms, and brine-bred discipline.',
    palette: ['sea green', 'kelp black', 'brine cyan', 'rust leather'],
    techLanguage: 'amphibious firearms, bioluminescent harnesses, pressure-forged polearms, mutation chambers',
    materialLanguage: 'scaled skin, salt-worn webbing, wet leather, shell-like plating',
    sourceArtPaths: [
      'art/units/myrmidon-concept.jpg',
      'art/units/myrmidon-hunter.jpg',
      'art/units/myrmidon-spectre.jpg'
    ]
  },
  'the-order': {
    id: 'the-order',
    displayName: 'The Order',
    motto: 'Order through power.',
    summary: 'Templar-descended noble houses who emerge from Antarctic bunker-cities with regimented doctrine, relic firearms, and imperial ambition.',
    palette: ['iron black', 'aged brass', 'dark wine', 'parchment ivory'],
    techLanguage: 'relic rifles, sealed bunker armor, command sigils, surgical kit technology',
    materialLanguage: 'brushed steel, waxed cloth, weathered leather, brass fastenings',
    sourceArtPaths: ['art/units/theorder-concept.jpg', 'art/units/theorder-squire.jpg']
  },
  'children-of-the-prophecy': {
    id: 'children-of-the-prophecy',
    displayName: 'The Children of the Prophecy',
    motto: 'We are the guardians of Aevum.',
    summary: 'An ascetic psychic order that returns from isolation with ritual discipline, visionary doctrine, and reality-bending mental power.',
    palette: ['sun-faded sand', 'bone white', 'ember red', 'dusty umber'],
    techLanguage: 'psychic foci, pilgrim polearms, memory relics, meditative field tools',
    materialLanguage: 'wrapped cloth, worn bone, carved wood, ritual metal fittings',
    sourceArtPaths: ['art/units/childrenofprophecy-concept.jpg']
  }
};

export function getFactionProfile(factionId: FactionId): FactionProfile {
  return FACTION_PROFILES[factionId];
}
