/* [HAUNT-SETUP] The five "reason for being here" cards. Players pick one at game start.
   In pass-and-play a single card is chosen. In online play each player votes and one
   is selected randomly weighted by frequency.
   hauntsByOmen maps each omen card ID to the haunt ID it triggers for that scenario.
   These mappings are hidden from players — fill them in once the omen→haunt table is decided. */

// Omen card IDs: "armor" | "book" | "dagger" | "dog" | "holy-symbol" | "idol" | "mask" | "ring" | "skull"

export const SCENARIO_CARDS = [
  {
    id: "paranormal-investigators",
    name: "Paranormal Investigators",
    description:
      "You're a ragtag team of paranormal investigators. You're all here because there's something wrong with this house, but what?",
    hauntsByOmen: {
      armor: "haunt_47",
      book: "haunt_16",
      dagger: "haunt_15",
      dog: "haunt_42",
      "holy-symbol": "haunt_31",
      idol: "haunt_28",
      mask: "haunt_5",
      ring: "haunt_18",
      skull: "haunt_32",
    },
  },
  {
    id: "cursed",
    name: "Cursed!",
    description:
      "You've all been cursed! You've got to find a way to fix things, and fast. There must be something in this house that can break the curse.",
    hauntsByOmen: {
      armor: "haunt_50",
      book: "haunt_39",
      dagger: "haunt_17",
      dog: "haunt_20",
      "holy-symbol": "haunt_19",
      idol: "haunt_23",
      mask: "haunt_27",
      ring: "haunt_2",
      skull: "haunt_46",
    },
  },
  {
    id: "strange-disappearance",
    name: "A Strange Disappearance",
    description:
      "One of your friends has disappeared. Some amateur sleuthing puts their last known location here, at this old house.",
    hauntsByOmen: {
      armor: "haunt_25",
      book: "haunt_21",
      dagger: "haunt_11",
      dog: "haunt_43",
      "holy-symbol": "haunt_13",
      idol: "haunt_34",
      mask: "haunt_44",
      ring: "haunt_30",
      skull: "haunt_35",
    },
  },
  {
    id: "mysterious-invitation",
    name: "A Mysterious Invitation",
    description:
      "Each of you received a mysterious letter, inviting you to this house. You're beginning to regret the choice you made in accepting that invitation.",
    hauntsByOmen: {
      armor: "haunt_37",
      book: "haunt_45",
      dagger: "haunt_6",
      dog: "haunt_8",
      "holy-symbol": "haunt_26",
      idol: "haunt_9",
      mask: "haunt_24",
      ring: "haunt_38",
      skull: "haunt_48",
    },
  },
  {
    id: "for-sale",
    name: "For Sale",
    description:
      "This old house is a real fixer-upper, but the price is right. Some of you are prospective buyers, while others are here because the open house has free food. The realtor looks glad to have any visitors at all.",
    hauntsByOmen: {
      armor: "haunt_10",
      book: "haunt_14",
      dagger: "haunt_49",
      dog: "haunt_4",
      "holy-symbol": "haunt_36",
      idol: "haunt_41",
      mask: "haunt_40",
      ring: "haunt_29",
      skull: "haunt_22",
    },
  },
];
