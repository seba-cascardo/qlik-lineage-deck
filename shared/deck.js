/*
 * Scene order for the player (deck/index.html) and the presenter window (deck/presenter.html).
 * Titles and `plan` (the planned start time, m:ss) come from storyboard.html v4; qa/test_player.py checks them.
 *
 * DECK_THEME is the theme when the URL has no ?theme=: the player passes it to every scene and to the presenter.
 * Plan B (docs/plans/2026-10-20-night-map-deck.md, Checkpoint 1): set it to "day".
 */
window.DECK_THEME = "night";
window.DECK_THEMES = ["night", "day"];   // the themes of deck/shared/world/theme.js

window.DECK = [
  { id: "s01", file: "scenes/s01.html", title: "Title",                                        plan: "0:00" },
  { id: "s02", file: "scenes/s02.html", title: "Qlik in 90 seconds",                           plan: "0:20" },
  { id: "s03", file: "scenes/s03.html", title: "Which one can we delete?",                     plan: "1:50" },
  { id: "s04", file: "scenes/s04.html", title: "We weren't short of data",                     plan: "2:50" },
  { id: "s05", file: "scenes/s05.html", title: "Four questions we couldn't answer",            plan: "3:35" },
  { id: "s06", file: "scenes/s06.html", title: "The map we need",                              plan: "4:50" },
  { id: "s07", file: "scenes/s07.html", title: "Then came a smaller question",                 plan: "5:30" },
  { id: "s08", file: "scenes/s08.html", title: "The answer was in the diary",                  plan: "6:30" },
  { id: "s09", file: "scenes/s09.html", title: "One clue became a method",                     plan: "8:30" },
  { id: "s10", file: "scenes/s10.html", title: "Back to our four questions",                   plan: "10:15" },
  { id: "s11", file: "scenes/s11.html", title: "Is it still used? Data files",                 plan: "10:30" },
  { id: "s12", file: "scenes/s12.html", title: "Is it still used? Connections and containers", plan: "12:15" },
  { id: "s13", file: "scenes/s13.html", title: "What belongs together? Products",              plan: "13:00" },
  { id: "s14", file: "scenes/s14.html", title: "Measured as products",                         plan: "14:15" },
  { id: "s15", file: "scenes/s15.html", title: "Does it follow the rules?",                    plan: "15:00" },
  { id: "s16", file: "scenes/s16.html", title: "Who owns it? The Owners Dashboard",            plan: "15:40" },
  { id: "s17", file: "scenes/s17.html", title: "The map we didn't have",                       plan: "17:15" },
  { id: "s18", file: "scenes/s18.html", title: "Dots and lines",                               plan: "17:45" },
  { id: "s19", file: "scenes/s19.html", title: "End frame",                                    plan: "19:00" }
];
