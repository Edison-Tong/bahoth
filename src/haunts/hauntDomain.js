export { GAME_PHASES, HAUNT_ACTION_LIMIT_SCOPE, HAUNT_TEAMS } from "./core/hauntPhases";
export {
	dismissHauntRollState,
	startHauntFromTriggerState,
	completeHauntSetupState,
	resolveHaunt1LearnAboutJackState,
} from "./core/hauntRuntime";
export { getHauntDefinitionById, selectTriggeredHauntDefinition } from "./registry";
