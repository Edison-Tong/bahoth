// Thin controller wrapper — delegates directly to confirmDamageChoiceState.
import { confirmDamageChoiceState } from "./playerState";

/* [DAMAGE] Thin controller wrapper — delegates directly to confirmDamageChoiceState. */
export function resolveConfirmDamageChoiceActionState(game, deps) {
  return confirmDamageChoiceState(game, deps);
}
