/* [HAUNT-SETUP] The five "reason for being here" cards. Players pick one at game start.
   In pass-and-play a single card is chosen. In online play each player votes and one
   is selected randomly weighted by frequency.
   The omen→haunt mapping for each card is stored separately and never shown to players. */
export const REASON_CARDS = [
  {
    id: "paranormal-investigators",
    name: "Paranormal Investigators",
    description:
      "You're a ragtag team of paranormal investigators. You're all here because there's something wrong with this house, but what?",
  },
  {
    id: "cursed",
    name: "Cursed!",
    description:
      "You've all been cursed! You've got to find a way to fix things, and fast. There must be something in this house that can break the curse.",
  },
  {
    id: "strange-disappearance",
    name: "A Strange Disappearance",
    description:
      "One of your friends has disappeared. Some amateur sleuthing puts their last known location here, at this old house.",
  },
  {
    id: "mysterious-invitation",
    name: "A Mysterious Invitation",
    description:
      "Each of you received a mysterious letter, inviting you to this house. You're beginning to regret the choice you made in accepting that invitation.",
  },
  {
    id: "for-sale",
    name: "For Sale",
    description:
      "This old house is a real fixer-upper, but the price is right. Some of you are prospective buyers, while others are here because the open house has free food. The realtor looks glad to have any visitors at all.",
  },
];
