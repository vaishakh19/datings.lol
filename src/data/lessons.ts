import { Lesson, RankInfo } from "../types";

export const LESSONS: Lesson[] = [
  {
    id: 1,
    title: "The Opener That Actually Works",
    subtitle: "Your first message decides everything.",
    paragraphs: [
      "Most openers fail because they're about YOU. 'Hey' 'wyd' 'you're hot' - it's all low effort and instantly forgettable. High-value openers are about THEM, specifically.",
      "Find ONE detail in their profile that's specific and playful. Not 'love your dog' but 'your dog looks like he's judging my entire existence and he's right.' Callback + humor = reply.",
      "Rule: If you can send the same opener to 10 people, it's trash. Rewrite it until it's undeniable."
    ],
    goodExample: "ok your third pic - are you actually holding a sword or is that a weird umbrella? either way i'm intrigued",
    badExample: "hey beautiful 😍",
    tags: ["dates", "texting"],
    blockers: ["shy", "profile"],
    task: {
      title: "Send 3 custom openers",
      desc: "No copy-paste. Reference something specific from each profile.",
      difficulty: "medium",
      xp: 25
    },
    color: "#FFE066"
  },
  {
    id: 2,
    title: "Stop The Double Text Spiral",
    subtitle: "Anxiety is not a strategy.",
    paragraphs: [
      "You sent a message. They didn't reply in 3 hours. Your brain: 'they hate me, i messed up, should I apologize??' No. Stop.",
      "Double texting signals neediness, not interest. The move is to live your life. If they were interested before your spiral, they'll reply. If not, a second text won't fix it.",
      "Set a rule: No double text for 24hrs. If they reply after, you respond normally - no guilt trip."
    ],
    goodExample: "[wait 24hrs, then if nothing] lol ok you left me on read, my ego is bruised but i'll survive",
    badExample: "sorry if that was weird?? hello?? you there??",
    tags: ["confidence", "texting"],
    blockers: ["overthink", "ghosted"],
    task: {
      title: "The 24hr Hold",
      desc: "Someone leaves you on read? Don't double text. Screenshot your willpower instead.",
      difficulty: "spicy",
      xp: 30
    },
    color: "#A78BFA"
  },
  {
    id: 3,
    title: "Profile Photos That Don't Suck",
    subtitle: "You're being judged in 0.8 seconds.",
    paragraphs: [
      "Your main photo is your whole first impression. Bathroom selfies, car selfies, sunglasses in every pic = instant left swipe. We need range.",
      "Formula: 1 clear face (smiling, natural light) + 1 full body doing something + 1 social proof + 1 hobby/chaos pic. No more than 1 gym mirror.",
      "Delete any photo you'd be embarrassed to show your future kids. Yes, that one too."
    ],
    goodExample: "Photo order: laughing at brunch → hiking with dog → friends at concert → you cooking badly but vibing",
    badExample: "4 identical gym selfies + 1 pic with ex cropped out badly",
    tags: ["dates"],
    blockers: ["profile"],
    task: {
      title: "Audit Your 6",
      desc: "Ask a brutally honest friend to rank your photos. Delete bottom 2.",
      difficulty: "easy",
      xp: 20
    },
    color: "#BEF264"
  },
  {
    id: 4,
    title: "From Match to Date in 5 Messages",
    subtitle: "Stop pen-palling forever.",
    paragraphs: [
      "The goal of texting is NOT to have great text chemistry. It's to get off the app. Every day you wait, attraction dies.",
      "Structure: Opener (specific) → banter (1-2 exchanges) → soft close ('we should...') → hard close ('tues or thurs work for you?').",
      "If you hit message 10 and haven't suggested a plan, you've already lost momentum."
    ],
    goodExample: "you seem cool and not boring - which is rare here. drinks this week? i'm free wed/thurs",
    badExample: "so what do you do for work? ...and where are you from? ...what music do you like?",
    tags: ["dates", "texting"],
    blockers: ["shy", "overthink"],
    task: {
      title: "The 5-Message Close",
      desc: "Take a current match and propose a specific plan within 5 messages.",
      difficulty: "medium",
      xp: 25
    },
    color: "#FDA4AF"
  },
  {
    id: 5,
    title: "How to Flirt Without Being Cringe",
    subtitle: "Flirting = playful challenge.",
    paragraphs: [
      "Cringe flirting is compliment-heavy: 'you're so gorgeous, you're perfect, omg.' It puts them on a pedestal and you below.",
      "Real flirting is push-pull. Tease them. Disagree lightly. 'you like pineapple on pizza? ok this is not gonna work... jk but we need to talk about this.'",
      "Think: 70% playful challenge, 30% genuine compliment. Not the other way around."
    ],
    goodExample: "dangerously close to being my type. i'm worried for both of us tbh",
    badExample: "you're literally the most beautiful person i've ever seen i can't believe you matched me",
    tags: ["confidence", "relationship"],
    blockers: ["shy", "overthink"],
    task: {
      title: "Tease, Don't Please",
      desc: "In your next convo, give one playful tease instead of a compliment.",
      difficulty: "medium",
      xp: 25
    },
    color: "#FFE066"
  },
  {
    id: 6,
    title: "The Callback Method",
    subtitle: "Memory is attraction.",
    paragraphs: [
      "People fall for people who actually listen. Callback = referencing something they said earlier. It shows you care and you're not just running game.",
      "If they said they have a big presentation Tuesday, text Tuesday: 'how'd the presentation go? did you crush it or cry in the bathroom? either is valid'",
      "Keep a notes app if you have to. Hot people remember details."
    ],
    goodExample: "wait did you ever finish that book you said was putting you to sleep? lol",
    badExample: "what were we talking about again? sorry i forgot",
    tags: ["texting", "relationship"],
    blockers: ["overthink"],
    task: {
      title: "One Callback Today",
      desc: "Bring up something someone told you >2 days ago. Watch their reaction.",
      difficulty: "easy",
      xp: 20
    },
    color: "#A78BFA"
  },
  {
    id: 7,
    title: "Reading Signals, Not Minds",
    subtitle: "Stop guessing, start observing.",
    paragraphs: [
      "Anxious attachment makes you read into everything. 'They used a period, they hate me.' Bro, they might just be busy.",
      "Look for patterns, not single texts. Are they asking questions back? Making plans? Laughing? That's interest. One dry reply is not data.",
      "If you're overthinking a text for more than 5 mins, you already have your answer: send it and go touch grass."
    ],
    goodExample: "They take hours but always reply with effort + questions = interested but busy",
    badExample: "They replied 'haha' - analyzing for 2 hours what it means",
    tags: ["confidence", "relationship"],
    blockers: ["overthink", "ghosted"],
    task: {
      title: "Pattern Check",
      desc: "Review your last 3 convos. Write down actual effort patterns, not feelings.",
      difficulty: "easy",
      xp: 15
    },
    color: "#BEF264"
  },
  {
    id: 8,
    title: "Ghosted? The 48hr Rule",
    subtitle: "It's not about you, but let's make it about growth.",
    paragraphs: [
      "Ghosting hurts because your brain makes it about your worth. It's not. People ghost because they're avoidant, talking to 10 people, or just... weird.",
      "Rule: After being ghosted, wait 48hrs. No stalking stories. No checking online status. On hour 49, you send ONE closure text or you delete the chat. No middle ground.",
      "Your time is too expensive to spend on someone who can't send a 3-word text."
    ],
    goodExample: "hey, felt like we had a vibe but seems like you're not feeling it. all good, wishing u well!",
    badExample: "why are you ghosting me??? i thought we had something???",
    tags: ["confidence", "texting"],
    blockers: ["ghosted"],
    task: {
      title: "Close a Loop",
      desc: "Delete one dead chat you've been holding onto. Screenshot the empty space.",
      difficulty: "spicy",
      xp: 35
    },
    color: "#FDA4AF"
  },
  {
    id: 9,
    title: "Confidence Is a Verb",
    subtitle: "You don't find confidence, you do confidence.",
    paragraphs: [
      "Waiting to 'feel confident' before you approach is a trap. Confidence comes AFTER you do the scary thing, not before.",
      "Micro-reps: Eye contact with a stranger for 2 seconds. Compliment a barista. Ask someone for directions even though you have maps. Small wins stack.",
      "Your brain needs evidence that you're THAT person. Give it evidence today."
    ],
    goodExample: "Doing the thing scared but doing it anyway = confidence rep",
    badExample: "Watching 100 TikToks about confidence but never talking to anyone",
    tags: ["confidence", "dates"],
    blockers: ["shy"],
    task: {
      title: "3 Micro-Reps",
      desc: "Compliment 1 stranger, make eye contact + smile at 2 people. No phone escape.",
      difficulty: "medium",
      xp: 25
    },
    color: "#FFE066"
  },
  {
    id: 10,
    title: "Tease, Don't Please",
    subtitle: "Nice is forgettable.",
    paragraphs: [
      "People-pleasers finish last in dating. Always agreeing, always available, always 'whatever you want' - it's boring and kills polarity.",
      "Have opinions. 'Actually I hate that bar, let's go here instead - trust me.' Leadership is attractive. Indecision is not.",
      "Boundaries are hot. 'I can't tonight but I'm free Thursday' > 'I'm free whenever works for you!'"
    ],
    goodExample: "i'm actually gonna say no to that plan - i have better idea. you in or you scared?",
    badExample: "whatever you want to do is fine! i don't mind! really whatever!",
    tags: ["confidence", "relationship"],
    blockers: ["shy", "overthink"],
    task: {
      title: "Say No Once",
      desc: "Disagree or suggest an alternative in a dating context today. Keep it playful.",
      difficulty: "spicy",
      xp: 30
    },
    color: "#A78BFA"
  },
  {
    id: 11,
    title: "Texting Rhythm",
    subtitle: "Match energy, not anxiety.",
    paragraphs: [
      "Texting has rhythm. If they send 2 sentences, you send 2 sentences. Not a paragraph. If they take 3 hours, you don't need to reply in 3 minutes.",
      "Mirroring isn't game-playing, it's respect for pacing. Chasing fast replies makes you look like you have nothing going on.",
      "Exception: If you're genuinely excited, be excited. Don't fake being chill. But don't be consistently more invested in text length/effort."
    ],
    goodExample: "Them: 1 line → You: 1-2 lines. Them: story → You: story + question",
    badExample: "Them: 'lol nice' → You: 4 paragraphs about your childhood",
    tags: ["texting"],
    blockers: ["overthink", "ghosted"],
    task: {
      title: "Mirror Check",
      desc: "In your next chat, consciously match their length and response time.",
      difficulty: "easy",
      xp: 15
    },
    color: "#BEF264"
  },
  {
    id: 12,
    title: "First Date Framework",
    subtitle: "Don't interview, create a moment.",
    paragraphs: [
      "Worst first dates feel like job interviews. Best ones feel like inside jokes being born.",
      "Framework: Arrive 5 mins early, compliment + light tease in first 2 mins, ask story-based questions ('what's the most chaotic thing you've done this year?'), and end with a future reference ('we'd be terrible at karaoke together').",
      "Goal is not to impress. Goal is to see if YOU like THEM."
    ],
    goodExample: "ok most important question: would you survive a zombie apocalypse or be first to go?",
    badExample: "so where do you see yourself in 5 years? what's your salary?",
    tags: ["dates", "relationship"],
    blockers: ["shy", "profile"],
    task: {
      title: "Prep 3 Chaotic Qs",
      desc: "Write 3 fun, non-boring questions you'd actually want to answer.",
      difficulty: "easy",
      xp: 20
    },
    color: "#FDA4AF"
  },
  {
    id: 13,
    title: "Handling Rejection Like Main Character",
    subtitle: "Rejection is redirection, but also data.",
    paragraphs: [
      "Every person who doesn't like you is saving you time. Seriously. You don't want to be with someone who needs convincing.",
      "Instead of 'I'm not enough', try 'we weren't a match - what's the data?' Did you lead with neediness? Were you not your real self? Adjust, don't collapse.",
      "Main characters get rejected and keep their plot moving. Side characters spiral for 3 days."
    ],
    goodExample: "ok that didn't work, what can i tweak? next.",
    badExample: "i knew it, i'm unlovable, deleting all apps forever (until tomorrow)",
    tags: ["confidence"],
    blockers: ["ghosted", "shy"],
    task: {
      title: "Rejection Receipt",
      desc: "Write down one recent rejection and 1 thing you learned, not felt.",
      difficulty: "medium",
      xp: 25
    },
    color: "#FFE066"
  },
  {
    id: 14,
    title: "Keeping Spark After Date 2",
    subtitle: "The talking stage is where most fumble.",
    paragraphs: [
      "Date 1 is chemistry, Date 2 is curiosity, Date 3+ is consistency. Most people try too hard to impress and forget to build tension.",
      "Don't become their text buddy. Keep some mystery. 'I had a thought about you today but I'll tell you on Thursday' > daily good morning texts.",
      "Create rituals, not routines. Tuesday memes. Friday voice notes. Not 'wyd' every 3 hours."
    ],
    goodExample: "can't stop thinking about that story you told. you're more chaotic than you look, i like it",
    badExample: "good morning ☀️ good afternoon! good night! [every day same]",
    tags: ["relationship", "texting"],
    blockers: ["overthink"],
    task: {
      title: "Create a Ritual",
      desc: "Start one low-effort ritual with someone you're seeing (meme, voice note, etc)",
      difficulty: "medium",
      xp: 25
    },
    color: "#A78BFA"
  },
  {
    id: 15,
    title: "Your Vibe Is Your Filter",
    subtitle: "Stop trying to be everyone's type.",
    paragraphs: [
      "Trying to be liked by everyone makes you forgettable to everyone. Polarizing profiles get fewer matches but WAY better dates.",
      "Put your weird in your bio. Love astrology? Say it. Hate brunch? Say it. Want something serious? SAY IT. The right people will self-select.",
      "Your job isn't to get the most matches. It's to get the RIGHT matches who already get your humor."
    ],
    goodExample: "bio: 'professional overthinker, amateur dj, will beat you at mario kart and be smug about it'",
    badExample: "bio: 'just a chill guy/girl looking for chill vibes, ask me anything!'",
    tags: ["dates", "relationship"],
    blockers: ["profile", "shy"],
    task: {
      title: "Rewrite Your Bio",
      desc: "Make it 70% specific/weird, 30% attractive. No more 'fluent in sarcasm'.",
      difficulty: "spicy",
      xp: 30
    },
    color: "#BEF264"
  }
];

export function getRankInfo(xp: number): RankInfo {
  if (xp < 100) return { name: "Awkward Turtle", emoji: "🐢", next: 100, color: "#BEF264" };
  if (xp < 300) return { name: "Smooth Talker", emoji: "😏", next: 300, color: "#FFE066" };
  if (xp < 700) return { name: "Main Character", emoji: "✨", next: 700, color: "#A78BFA" };
  return { name: "Rizz Lord", emoji: "👑", next: 1500, color: "#FDA4AF" };
}
