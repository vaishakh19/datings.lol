export interface HotTake {
  id: string;
  topic: string;
  statement: string;
  subtext: string;
  agreePercent: number;
  disagreePercent: number;
  complicatedPercent: number;
  coachInsight: {
    agree: string;
    disagree: string;
    complicated: string;
  };
  bonusXp: number;
}

export const HOT_TAKES: HotTake[] = [
  {
    id: "hottake-1",
    topic: "The Bill Debate",
    statement: "Splitting the bill 50/50 on a first dinner date is an instant chemistry killer.",
    subtext: "Are we business partners doing expense accounting, or on a romantic date?",
    agreePercent: 46,
    disagreePercent: 41,
    complicatedPercent: 13,
    coachInsight: {
      agree: "Coach take: Real talk. Whoever asked the other out should offer to pay. If they offer to split, let them grab the next drinks/gelato.",
      disagree: "Coach take: Modern dating isn't the 1950s! But keep it frictionless—don't sit there calculating 18% tip on a Caesar salad.",
      complicated: "Coach take: Just avoid expensive dinners on date #1. Drinks or matcha solves 100% of this stress.",
    },
    bonusXp: 25,
  },
  {
    id: "hottake-2",
    topic: "Response Time",
    statement: "If they take 8+ hours to reply while posting IG stories, they just aren't into you.",
    subtext: "Nobody is 'too busy' for 8 hours to send a 5-word message to someone they actually like.",
    agreePercent: 78,
    disagreePercent: 14,
    complicatedPercent: 8,
    coachInsight: {
      agree: "Coach take: 100% truth. People check their phones 150x a day. Match their energy immediately, don't double text, and move on.",
      disagree: "Coach take: Sometimes people doomscroll brain-dead content when socially drained. But don't make excuses for habitual ghosters.",
      complicated: "Coach take: If it happens once, benefit of doubt. If it's a pattern, that's their communication style—take it or leave it.",
    },
    bonusXp: 25,
  },
  {
    id: "hottake-3",
    topic: "The Double Text",
    statement: "Double texting is completely fine if you're funny and changing the subject.",
    subtext: "The 'wait 3 days to text' rules are outdated mind games.",
    agreePercent: 62,
    disagreePercent: 28,
    complicatedPercent: 10,
    coachInsight: {
      agree: "Coach take: Based! Sending a meme or reviving a conversation with zero pressure shows confidence. Just never send 'Did you get my text?'.",
      disagree: "Coach take: Hold your horses. If they left you on read, let them sit in the silence for a couple of days before pinging.",
      complicated: "Coach take: 1 playful ping after 48h is fine. A 3rd text is entering restraining order territory.",
    },
    bonusXp: 25,
  },
  {
    id: "hottake-4",
    topic: "First Date Venue",
    statement: "A casual drink or coffee first date is infinitely superior to a sit-down dinner.",
    subtext: "Lower stakes, easy 45-minute exit route if no chemistry, and zero awkward food chewing.",
    agreePercent: 84,
    disagreePercent: 11,
    complicatedPercent: 5,
    coachInsight: {
      agree: "Coach take: Massive green flag strategy. Drinks can extend to dinner if vibes are immaculate, but can end at 45m without trapped agony.",
      disagree: "Coach take: Some people think drinks feel low-effort. If you do drinks, pick a bar with personality (speakeasy, arcade, views).",
      complicated: "Coach take: Match the vibe to their profile! If their bio is all Michelin dining, a corner bodega coffee might not hit.",
    },
    bonusXp: 25,
  },
  {
    id: "hottake-5",
    topic: "App Velocity",
    statement: "If you don't ask them out within 10 messages, the chat will die a slow death.",
    subtext: "Pen pals belong in the 19th century. Dating apps are meant for setting real-world dates.",
    agreePercent: 72,
    disagreePercent: 19,
    complicatedPercent: 9,
    coachInsight: {
      agree: "Coach take: The golden rule! Build quick banter, establish 1 shared interest, then lock in the date. Momentum is everything.",
      disagree: "Coach take: Some people need a vibe check first. Throw in a quick voice note before proposing a meet.",
      complicated: "Coach take: Don't ask on text 2 (creepy), but don't chat for 3 weeks (boring). Message 6 to 10 is the sweet spot.",
    },
    bonusXp: 25,
  },
  {
    id: "hottake-6",
    topic: "The 'Hey' Opener",
    statement: "Opening with 'Hey', 'Hi', or '👋' deserves an instant unmatch.",
    subtext: "With 6 photos and 3 prompts to work with, sending 3 letters is criminal lack of effort.",
    agreePercent: 69,
    disagreePercent: 22,
    complicatedPercent: 9,
    coachInsight: {
      agree: "Coach take: Absolutely! Even a playful comment on their dog or favorite cocktail gets 5x higher reply rates. Zero effort = zero dates.",
      disagree: "Coach take: Give them one chance to be funny on reply #2. Some people are just shy app users.",
      complicated: "Coach take: If they're a 10/10, you know you're replying anyway. Don't cap!",
    },
    bonusXp: 25,
  },
  {
    id: "hottake-7",
    topic: "Voice Notes",
    statement: "Sending a 15-second voice note before the first date is a cheat code for chemistry.",
    subtext: "Hearing someone's voice and laugh eliminates 90% of catfish anxiety and builds instant warmth.",
    agreePercent: 65,
    disagreePercent: 24,
    complicatedPercent: 11,
    coachInsight: {
      agree: "Coach take: High-tier rizz move. Vocal tone and inflection communicate warmth that text bubbles simply cannot carry.",
      disagree: "Coach take: Keep it short! Nobody wants a 3-minute podcast episode from someone they haven't met.",
      complicated: "Coach take: Only send it once banter is already flowing. Don't open with an audio recording out of nowhere.",
    },
    bonusXp: 25,
  },
];

/**
 * Gets today's deterministic hot take based on the day of the year
 */
export const getTodayHotTake = (): HotTake => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const index = Math.abs(dayOfYear) % HOT_TAKES.length;
  return HOT_TAKES[index];
};
