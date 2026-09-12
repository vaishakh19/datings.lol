import { Lesson } from "../types";

export type TeachingType = "LESSON" | "REMINDER" | "MYTH" | "BREAKDOWN" | "CASE STUDY" | "COACH TIP" | "CHALLENGE" | "WEEKLY TEACHING";

export interface CommunityTeaching {
  id: string;
  category: string;
  type: TeachingType;
  title: string;
  subtitle: string;
  intro: string;
  problem: string;
  why: string;
  doInstead: string;
  badExample: string;
  betterExample: string;
  takeaway: string;
  readTime: number;
  xp: number;
  accent: string;
  tags: string[];
  lessonId?: number;
  challenge?: string;
  featured?: boolean;
}

const categoryForLesson = (lesson: Lesson): string => {
  if (lesson.tags.includes("confidence")) return "CONFIDENCE";
  if (lesson.tags.includes("relationship")) return "RELATIONSHIPS";
  if (lesson.tags.includes("dates")) return "DATES";
  return "TEXTING";
};

export const COMMUNITY_TEACHINGS: CommunityTeaching[] = [
  {
    id: "teaching-breathe",
    category: "TEXTING",
    type: "BREAKDOWN",
    title: "Stop trying to keep the chat alive",
    subtitle: "A conversation is not a solo performance.",
    intro: "If they give you one-word replies, you do not need to perform harder.",
    problem: "You keep adding questions, jokes, and follow-ups because silence feels like failure.",
    why: "Over-functioning makes the conversation feel like an interview and hides whether they are willing to meet you halfway.",
    doInstead: "Offer one real detail about yourself, then leave room. Their effort is information.",
    badExample: "wyd? / nothing / oh / what are you doing tomorrow?",
    betterExample: "same 😂 i'm deciding whether to be productive or completely waste tonight.",
    takeaway: "You do not need to force momentum. Let the conversation breathe.",
    readTime: 2,
    xp: 15,
    accent: "#FFE066",
    tags: ["texting", "overthinking"],
    featured: true,
  },
  {
    id: "teaching-confidence",
    category: "CONFIDENCE",
    type: "REMINDER",
    title: "Confidence is a verb",
    subtitle: "You do not find confidence. You collect evidence.",
    intro: "Waiting until you feel ready is how the same conversation stays imaginary.",
    problem: "You rehearse the perfect opener until the moment is gone.",
    why: "Your brain treats avoidance as proof that the situation is dangerous.",
    doInstead: "Take one small social risk: eye contact, a clear compliment, or a specific invitation.",
    badExample: "Watching 100 confidence videos and never saying the thing.",
    betterExample: "You seem fun. Want to grab coffee Thursday?",
    takeaway: "Small reps count. The goal is evidence, not a flawless performance.",
    readTime: 2,
    xp: 15,
    accent: "#BEF264",
    tags: ["confidence", "asking_out"],
    lessonId: 9,
  },
  {
    id: "teaching-flirt",
    category: "FLIRTING",
    type: "COACH TIP",
    title: "Flirt without forcing it",
    subtitle: "Playful beats performative.",
    intro: "Flirting is not a pile of compliments. It is a little personality plus a little tension.",
    problem: "You put the other person on a pedestal and make every reply sound like approval-seeking.",
    why: "Constant praise removes your point of view, which is the part people can actually connect with.",
    doInstead: "Tease lightly, disagree playfully, and let a real compliment land occasionally.",
    badExample: "You are literally perfect. I cannot believe you matched me.",
    betterExample: "Dangerously close to being my type. I am worried for both of us tbh.",
    takeaway: "Give them a reason to feel your personality, not just your interest.",
    readTime: 2,
    xp: 15,
    accent: "#FDA4AF",
    tags: ["flirting", "confidence"],
    lessonId: 5,
  },
  {
    id: "teaching-ask-out",
    category: "DATES",
    type: "LESSON",
    title: "Do not become their pen pal",
    subtitle: "Good texting should eventually become a plan.",
    intro: "The goal is not to build a perfect text relationship. It is to find out if you click in real life.",
    problem: "You keep asking background questions while the energy slowly evaporates.",
    why: "Infinite texting feels safer than making a clear ask, but it creates fake momentum.",
    doInstead: "Build a little banter, name a shared interest, and suggest a specific day.",
    badExample: "What do you do? Where are you from? What music do you like?",
    betterExample: "You seem cool and not boring, which is rare here. Drinks Wednesday or Thursday?",
    takeaway: "Clarity is kinder than a three-week talking stage.",
    readTime: 3,
    xp: 20,
    accent: "#A78BFA",
    tags: ["dates", "asking_out", "texting"],
    lessonId: 4,
  },
  {
    id: "teaching-rejection",
    category: "REJECTION",
    type: "MYTH",
    title: "Rejection is data, not a verdict",
    subtitle: "One no does not explain your entire dating life.",
    intro: "A mismatch can hurt without becoming a story about your worth.",
    problem: "You turn one unanswered message into evidence that you should stop trying.",
    why: "Your brain wants a clean explanation, so it picks the most personal one.",
    doInstead: "Ask what the interaction taught you, adjust one variable, and keep your plot moving.",
    badExample: "I knew it. I am unlovable. Deleting every app forever.",
    betterExample: "That did not work. What can I tweak? Next.",
    takeaway: "Do not collapse a useful data point into an identity.",
    readTime: 2,
    xp: 15,
    accent: "#111",
    tags: ["rejection", "mindset"],
    lessonId: 13,
  },
];

export function getTeachingForLesson(lessonId: number): CommunityTeaching | undefined {
  return COMMUNITY_TEACHINGS.find((teaching) => teaching.lessonId === lessonId);
}
