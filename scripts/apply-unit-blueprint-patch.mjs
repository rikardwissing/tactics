import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const blueprintsPath = path.join(repoRoot, 'src/game/levels/data/unitBlueprints.json');

const EDITABLE_BLUEPRINT_FIELDS = [
  'spriteDisplayHeight',
  'spriteOffsetX',
  'spriteOffsetY',
  'maxHp',
  'move',
  'speed',
  'attack',
  'defense',
  'rangeMin',
  'rangeMax',
  'jump'
];

const EDITABLE_ABILITY_FIELDS = ['rangeMin', 'rangeMax', 'powerModifier', 'healAmount'];

function sanitizeInteger(value, minimum) {
  return Math.max(minimum, Math.round(Number(value)));
}

function sanitizeSignedInteger(value) {
  return Math.round(Number(value));
}

function getPrimaryAttackAbilityIndex(abilities) {
  const attackIndex = abilities.findIndex((ability) => ability.id === 'attack');

  if (attackIndex >= 0) {
    return attackIndex;
  }

  return abilities.findIndex((ability) => ability.kind === 'attack');
}

function sanitizeAbilityDraft(ability) {
  const minimumRange = ability.kind === 'heal' ? 0 : 1;
  const nextRangeMin = sanitizeInteger(ability.rangeMin, minimumRange);

  return {
    ...ability,
    rangeMin: nextRangeMin,
    rangeMax: Math.max(nextRangeMin, sanitizeInteger(ability.rangeMax, minimumRange)),
    powerModifier: ability.powerModifier == null ? undefined : sanitizeSignedInteger(ability.powerModifier),
    healAmount: ability.healAmount == null ? undefined : sanitizeInteger(ability.healAmount, 0)
  };
}

function sanitizeBlueprint(blueprint) {
  const nextRangeMin = sanitizeInteger(blueprint.rangeMin, 1);

  return {
    ...blueprint,
    spriteDisplayHeight: sanitizeInteger(blueprint.spriteDisplayHeight, 1),
    spriteOffsetX: sanitizeSignedInteger(blueprint.spriteOffsetX ?? 0),
    spriteOffsetY: sanitizeSignedInteger(blueprint.spriteOffsetY ?? 0),
    maxHp: sanitizeInteger(blueprint.maxHp, 1),
    move: sanitizeInteger(blueprint.move, 0),
    speed: sanitizeInteger(blueprint.speed, 1),
    attack: sanitizeInteger(blueprint.attack, 0),
    defense: sanitizeInteger(blueprint.defense, 0),
    rangeMin: nextRangeMin,
    rangeMax: Math.max(nextRangeMin, sanitizeInteger(blueprint.rangeMax, 1)),
    jump: sanitizeInteger(blueprint.jump, 0),
    abilities: blueprint.abilities.map(sanitizeAbilityDraft)
  };
}

function applyBlueprintPatch(sourceBlueprint, blueprintPatch) {
  const nextBlueprint = {
    ...sourceBlueprint,
    abilities: sourceBlueprint.abilities.map((ability) => ({ ...ability }))
  };

  for (const field of EDITABLE_BLUEPRINT_FIELDS) {
    if (Object.hasOwn(blueprintPatch, field)) {
      nextBlueprint[field] = blueprintPatch[field];
    }
  }

  const primaryAttackIndex = getPrimaryAttackAbilityIndex(nextBlueprint.abilities);

  if (primaryAttackIndex >= 0 && (Object.hasOwn(blueprintPatch, 'rangeMin') || Object.hasOwn(blueprintPatch, 'rangeMax'))) {
    nextBlueprint.abilities[primaryAttackIndex] = {
      ...nextBlueprint.abilities[primaryAttackIndex],
      rangeMin: nextBlueprint.rangeMin,
      rangeMax: nextBlueprint.rangeMax
    };
  }

  if (blueprintPatch.abilities && typeof blueprintPatch.abilities === 'object') {
    for (const [abilityId, abilityPatch] of Object.entries(blueprintPatch.abilities)) {
      const abilityIndex = nextBlueprint.abilities.findIndex((ability) => ability.id === abilityId);

      if (abilityIndex < 0) {
        throw new Error(`Unknown ability '${abilityId}' in blueprint '${sourceBlueprint.id}'`);
      }

      const nextAbility = { ...nextBlueprint.abilities[abilityIndex] };

      for (const field of EDITABLE_ABILITY_FIELDS) {
        if (Object.hasOwn(abilityPatch, field)) {
          nextAbility[field] = abilityPatch[field];
        }
      }

      nextBlueprint.abilities[abilityIndex] = sanitizeAbilityDraft(nextAbility);

      if (abilityIndex === primaryAttackIndex && (Object.hasOwn(abilityPatch, 'rangeMin') || Object.hasOwn(abilityPatch, 'rangeMax'))) {
        nextBlueprint.rangeMin = nextBlueprint.abilities[abilityIndex].rangeMin;
        nextBlueprint.rangeMax = nextBlueprint.abilities[abilityIndex].rangeMax;
      }
    }
  }

  return sanitizeBlueprint(nextBlueprint);
}

async function main() {
  const patchArg = process.argv[2];

  if (!patchArg) {
    console.error('Usage: npm run apply-unit-patch -- <path-to-patch.json>');
    process.exit(1);
  }

  const patchPath = path.resolve(process.cwd(), patchArg);
  const [rawBlueprints, rawPatch] = await Promise.all([
    fs.readFile(blueprintsPath, 'utf8'),
    fs.readFile(patchPath, 'utf8')
  ]);
  const blueprints = JSON.parse(rawBlueprints);
  const patchMap = JSON.parse(rawPatch);

  if (!patchMap || typeof patchMap !== 'object' || Array.isArray(patchMap)) {
    throw new Error('Patch root must be a JSON object keyed by blueprint id');
  }

  for (const [blueprintId, blueprintPatch] of Object.entries(patchMap)) {
    if (!Object.hasOwn(blueprints, blueprintId)) {
      throw new Error(`Unknown blueprint '${blueprintId}' in patch`);
    }

    blueprints[blueprintId] = applyBlueprintPatch(blueprints[blueprintId], blueprintPatch ?? {});
  }

  await fs.writeFile(blueprintsPath, `${JSON.stringify(blueprints, null, 2)}\n`);
  console.log(`Applied ${Object.keys(patchMap).length} blueprint patch${Object.keys(patchMap).length === 1 ? '' : 'es'} to ${path.relative(repoRoot, blueprintsPath)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
