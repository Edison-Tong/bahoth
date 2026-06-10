// Thin controller wrapper — delegates directly to confirmDamageChoiceState.
import { confirmDamageChoiceState } from "./playerState";

export function resolveConfirmDamageChoiceActionState(game, deps) {
  return confirmDamageChoiceState(game, deps);
}
