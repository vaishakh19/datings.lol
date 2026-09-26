// ============================================================================
// datings.lol — Blog articles
// Written in the house voice: brutally honest, funny, actually useful.
// ============================================================================

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; title: string; text: string }
  | { type: "example"; good: string; bad: string }
  | { type: "quote"; text: string; by?: string };

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: ArticleCategory;
  emoji: string;
  color: string;
  author: { name: string; role: string; avatar: string };
  date: string; // ISO date
  readMins: number;
  featured?: boolean;
  blocks: ArticleBlock[];
}

export type ArticleCategory =
  | "Openers"
  | "Texting"
  | "Profile Glow-Up"
  | "First Dates"
  | "Mindset"
  | "Hot Takes";

export const CATEGORY_COLORS: Record<ArticleCategory, string> = {
  Openers: "#FFE066",
  Texting: "#A78BFA",
  "Profile Glow-Up": "#BEF264",
  "First Dates": "#FDA4AF",
  Mindset: "#7DD3FC",
  "Hot Takes": "#FDBA74",
};

const COACH = { name: "Coach d.", role: "Head Roaster, datings.lol", avatar: "d." };

export const ARTICLES: Article[] = [
  {
    slug: "openers-that-get-replies",
    title: "The Opener That Gets Replies (And the One That Gets You Left on Sent)",
    excerpt:
      "Your first message decides everything. Here's the anatomy of an opener that actually earns a reply — and the copy-paste garbage you need to delete forever.",
    category: "Openers",
    emoji: "💬",
    color: "#FFE066",
    author: COACH,
    date: "2026-09-18",
    readMins: 6,
    featured: true,
    blocks: [
      {
        type: "p",
        text: "Let's get one thing straight: nobody has ever stared at their phone, seen the word 'hey', felt their heart skip a beat, and cancelled their plans to reply. Your opener is a job application for someone's attention, and 'hey' is a blank resume.",
      },
      {
        type: "h2",
        text: "Why most openers die on arrival",
      },
      {
        type: "p",
        text: "The average person with a decent profile gets dozens of openers a week. 90% of them are interchangeable: hey, heyy, wyd, you're gorgeous, how's your week. When your message is identical to nine others in the inbox, you're not competing — you're wallpaper.",
      },
      {
        type: "p",
        text: "Openers fail for one core reason: they're about YOU. Your boredom, your attraction, your need for a reply. A great opener flips the camera around. It proves, in one sentence, that you actually looked at their profile and had a thought about it.",
      },
      {
        type: "h2",
        text: "The anatomy of an opener that works",
      },
      {
        type: "list",
        items: [
          "SPECIFIC: references one exact detail from their profile — a photo, a prompt answer, the weird thing in the background of pic three.",
          "PLAYFUL: has an angle. A joke, a fake accusation, an absurd observation. Something with texture.",
          "ANSWERABLE: ends somewhere easy to respond to. A question, a challenge, an obvious setup for a comeback.",
        ],
      },
      {
        type: "example",
        good: "ok your third pic — are you actually holding a sword or is that the world's most aggressive umbrella? either way i'm intrigued",
        bad: "hey beautiful 😍 how's your day going",
      },
      {
        type: "callout",
        title: "The 10-person test",
        text: "If you could send the same opener to 10 different people without changing a word, it's trash. Rewrite it until it could only possibly be sent to this one person.",
      },
      {
        type: "h2",
        text: "Three templates you can steal (then personalize)",
      },
      {
        type: "list",
        items: [
          "The fake accusation: 'be honest, [detail from their photo] was staged for the plot' — playful, specific, begs for a defense.",
          "The absurd stakes: 'important question that will determine everything: [tiny detail]?' — makes a small thing dramatic.",
          "The judged-by-pet: 'your dog looks like he's judging my entire existence and honestly? he's right' — callback plus self-aware humor.",
        ],
      },
      {
        type: "p",
        text: "Notice none of these are 'clever pickup lines'. Lines are for everyone; observations are for them. The magic isn't in the template — it's in the specific detail you plug into it.",
      },
      {
        type: "h2",
        text: "What to do when the profile gives you nothing",
      },
      {
        type: "p",
        text: "Three mirror selfies and a bio that says 'just ask'? You have two options: skip it (valid), or make the emptiness the content: 'your bio says just ask, so — favorite conspiracy theory, best meal you've ever had, and what's your most controversial pizza topping. in that order.' You turned nothing into a game.",
      },
      {
        type: "quote",
        text: "If you can send it to 10 people, it's not an opener. It's spam with feelings.",
        by: "Lesson 1, datings.lol",
      },
      {
        type: "p",
        text: "Your homework: open your sent messages, find your last five openers, and count how many could've been sent to anyone. Then rewrite them. Or paste them into the Coach and let us roast them properly.",
      },
    ],
  },
  {
    slug: "hey-is-killing-your-match-rate",
    title: "'Hey' Is Killing Your Match Rate — a Forensic Report",
    excerpt:
      "We put the world's laziest opener under the microscope. The autopsy results are in, and the cause of death is effort. Or the total absence of it.",
    category: "Openers",
    emoji: "🔬",
    color: "#FFE066",
    author: COACH,
    date: "2026-09-04",
    readMins: 4,
    blocks: [
      {
        type: "p",
        text: "'Hey' feels safe. It's low-risk, low-effort, and impossible to mess up. It's also low-reward, because the reply rate on 'hey' is roughly the same as the reply rate on silence.",
      },
      {
        type: "h2",
        text: "What 'hey' actually communicates",
      },
      {
        type: "list",
        items: [
          "'I didn't read your profile.'",
          "'I'm sending this to several people right now.'",
          "'I would like you to carry this entire conversation.'",
          "'I have no plan.'",
        ],
      },
      {
        type: "p",
        text: "Harsh? Yes. But that's the decode happening on the other side of the screen in under a second. 'Hey' doesn't say hello — it delegates. It hands the other person a blank page and says 'you go first, and also make it interesting.'",
      },
      {
        type: "h2",
        text: "The 'hey' family tree (all equally cursed)",
      },
      {
        type: "list",
        items: [
          "heyy — 'hey' but you held the y down. Still nothing.",
          "wyd — a status check, not a conversation.",
          "hi :) — the smiley does not fix it.",
          "how's your week going — a question HR asks in the elevator.",
        ],
      },
      {
        type: "example",
        good: "you have 'fluent in sarcasm' in your bio which is a bold claim. prove it: roast my taste in one sentence, i can take it",
        bad: "heyy wyd",
      },
      {
        type: "callout",
        title: "The effort paradox",
        text: "People think low-effort openers protect them from rejection. Wrong. They guarantee it, just silently. A specific opener can be rejected — a lazy one is simply ignored, which somehow feels worse.",
      },
      {
        type: "p",
        text: "The fix takes 45 seconds: read the profile, find one thing, say one specific sentence about it. That's it. That's the entire hack. You don't need to be hilarious. You need to be the one message in the inbox that proves a human was present when it was written.",
      },
      {
        type: "quote",
        text: "'Hey' is not an opener. It's a receipt confirming you exist.",
      },
    ],
  },
  {
    slug: "double-text-survival-guide",
    title: "The Double Text Survival Guide",
    excerpt:
      "They read it. They didn't reply. Your thumb is hovering. Before you send 'haha did you see this?', read this. Anxiety is not a strategy.",
    category: "Texting",
    emoji: "📵",
    color: "#A78BFA",
    author: COACH,
    date: "2026-09-11",
    readMins: 5,
    blocks: [
      {
        type: "p",
        text: "It's been three hours. The message sits there, read, unanswered. Your brain starts the spiral: 'was it weird? it was weird. should I clarify? maybe a meme will fix it—' Stop. Put the phone down. We need to talk.",
      },
      {
        type: "h2",
        text: "What a double text actually signals",
      },
      {
        type: "p",
        text: "One unanswered message says 'the ball is in your court.' A second message before they respond says 'I am standing at the net, staring at you, asking why you haven't hit it back.' It converts interest into pressure — and pressure is repellent.",
      },
      {
        type: "callout",
        title: "The 24-hour rule",
        text: "No double texts for 24 hours. Not one. If they were interested before your silence, they'll reply. If they weren't, a second text was never going to change the outcome — it just costs you leverage.",
      },
      {
        type: "h2",
        text: "Why they might not be replying (a reality check)",
      },
      {
        type: "list",
        items: [
          "They're busy. People have jobs, gyms, families, and 14 other apps.",
          "They opened it in a moment they couldn't reply and forgot. It happens to you too.",
          "They're lukewarm. Painful, but no follow-up text has ever converted lukewarm to interested.",
          "It's genuinely over. In which case: congrats, you just saved yourself weeks.",
        ],
      },
      {
        type: "p",
        text: "Notice that in zero of these scenarios does a 'hello?? you there?' improve your position. In three of four, it actively hurts it.",
      },
      {
        type: "h2",
        text: "If you MUST send something after 24 hours",
      },
      {
        type: "p",
        text: "Send new value, not a status inquiry. A fresh topic, a funny observation, a callback to an earlier joke. Something that stands on its own instead of pointing at the corpse of the last message.",
      },
      {
        type: "example",
        good: "lol ok you left me on read, my ego is bruised but i'll survive. anyway I found the restaurant that beats your taco place claim. thoughts?",
        bad: "sorry if that was weird?? hello?? you there??",
      },
      {
        type: "p",
        text: "See the difference? One is a person with a life extending an invitation. The other is a hostage note written by anxiety.",
      },
      {
        type: "quote",
        text: "The strongest text you'll ever send is the one you don't.",
        by: "Lesson 2, datings.lol",
      },
      {
        type: "p",
        text: "Practical move: next time someone leaves you on read, screenshot your willpower instead of double texting. The 24-Hour Hold is literally a task in the app — it's worth 30 XP because it's genuinely hard.",
      },
    ],
  },
  {
    slug: "dry-texter-rehab",
    title: "Dry Texter Rehab: Fixing Conversations That Feel Like Homework",
    excerpt:
      "If every reply you send could double as a customs form, this one's for you. How to stop interrogating and start actually vibing over text.",
    category: "Texting",
    emoji: "🏜️",
    color: "#A78BFA",
    author: COACH,
    date: "2026-08-27",
    readMins: 6,
    blocks: [
      {
        type: "p",
        text: "Symptoms of dry texting: every message you send is a question. Every question could appear on a government form. 'What do you do?' 'Where are you from?' 'How many siblings do you have?' Congratulations, you've turned flirting into a census.",
      },
      {
        type: "h2",
        text: "The core problem: you're interviewing, not playing",
      },
      {
        type: "p",
        text: "Questions feel productive because they generate replies. But a conversation made only of questions has the emotional texture of a job interview. Attraction doesn't grow from data exchange. It grows from play — teasing, riffing, building tiny inside jokes.",
      },
      {
        type: "h2",
        text: "The statement-first rewrite",
      },
      {
        type: "p",
        text: "Take your interview question and convert it into a playful assumption. Assumptions invite correction, and correcting someone is the easiest, most fun reply in the world.",
      },
      {
        type: "list",
        items: [
          "'What do you do?' → 'you give off marketing-person-who-says-synergy-unironically energy. am I close?'",
          "'Do you like to travel?' → 'ranking guess: you're a beach person, not a mountains person. you seem like you'd complain about the hike.'",
          "'What music do you like?' → 'I need to know what your most embarrassing playlist is called before this goes any further.'",
        ],
      },
      {
        type: "example",
        good: "you strike me as someone whose camera roll is 80% pictures of food you never posted. defend yourself",
        bad: "so what are your hobbies?",
      },
      {
        type: "callout",
        title: "The 2:1 ratio",
        text: "For every question you ask, make two statements — an observation, a tease, a story fragment, a hot take. Statements carry the vibe; questions just steer it.",
      },
      {
        type: "h2",
        text: "Give answers with hooks",
      },
      {
        type: "p",
        text: "Dry texting goes both ways. If they ask 'how was your weekend?' and you reply 'good, pretty chill', you just handed them a dead end. Always leave a thread to pull: 'good — accidentally joined a pub quiz team and we came second to a table of retired teachers. still bitter.' Now there are three things to react to.",
      },
      {
        type: "quote",
        text: "Boring questions get boring answers. Give them something to push against.",
      },
      {
        type: "p",
        text: "Rehab assignment: take your driest active conversation, delete the question you were about to send, and replace it with a playful assumption. Watch what happens to the reply length.",
      },
    ],
  },
  {
    slug: "six-photo-profile-formula",
    title: "The 6-Photo Formula: Build a Profile That Survives 0.8 Seconds",
    excerpt:
      "That's how long your main photo gets before the swipe decision. Here's the exact lineup that works — and the photos silently sabotaging you.",
    category: "Profile Glow-Up",
    emoji: "📸",
    color: "#BEF264",
    author: COACH,
    date: "2026-09-14",
    readMins: 7,
    featured: true,
    blocks: [
      {
        type: "p",
        text: "Your profile is judged faster than you can blink. Literally — swipe decisions average under a second. Nobody is reading your bio first. The photos ARE the pitch, and most people's photo lineup is actively working against them.",
      },
      {
        type: "h2",
        text: "The formula",
      },
      {
        type: "list",
        items: [
          "SLOT 1 — Clear face, natural light, real smile. No sunglasses, no group shot, no car. This is 70% of the decision.",
          "SLOT 2 — Full body, doing something. Walking, cooking, at an event. Candid energy beats posed energy.",
          "SLOT 3 — Social proof. You with friends, mid-laugh. (You are not the one cropped in from the side.)",
          "SLOT 4 — Hobby or chaos pic. The thing that makes you a character: your bike, your terrible pottery, you losing a board game.",
          "SLOT 5 — Optional: the pet, the travel shot, the fit pic. ONE gym mirror maximum across the whole profile.",
          "SLOT 6 — The wildcard. Something with a story. This is the photo openers get written about.",
        ],
      },
      {
        type: "h2",
        text: "The silent profile killers",
      },
      {
        type: "list",
        items: [
          "Sunglasses in every photo — reads as 'hiding something'.",
          "Bathroom selfies — the flash, the toilet in frame, the ambience of despair.",
          "Four nearly identical selfies — one angle is not a personality.",
          "The badly cropped ex — we can see the hand. We can always see the hand.",
          "Blurry group shots where you're a lore character — nobody's playing Where's Waldo.",
        ],
      },
      {
        type: "example",
        good: "Photo order: laughing at brunch → hiking with the dog → friends at a concert → you cooking badly but vibing",
        bad: "4 identical gym selfies + 1 pic with an ex cropped out (badly)",
      },
      {
        type: "callout",
        title: "The brutal friend audit",
        text: "Ask your most honest friend to rank all your photos, worst to best. Delete the bottom two without argument. Your attachment to a photo has zero correlation with how it performs.",
      },
      {
        type: "h2",
        text: "Why range beats perfection",
      },
      {
        type: "p",
        text: "A profile of six polished, same-angle photos says 'I have one good angle and I'm terrified of the others.' A profile with range — face, body, friends, hobby, chaos — says 'here's an actual life you could be part of.' Attraction is imagining a slot in someone's world. Give them slots.",
      },
      {
        type: "quote",
        text: "Delete any photo you'd be embarrassed to show your future kids. Yes. That one too.",
        by: "Lesson 3, datings.lol",
      },
      {
        type: "p",
        text: "Do the Audit Your 6 task in the app this week. Twenty XP, two deleted photos, measurably better match rate. That's the whole trade.",
      },
    ],
  },
  {
    slug: "bios-that-dont-sound-like-linkedin",
    title: "Write a Bio That Doesn't Sound Like a LinkedIn Summary",
    excerpt:
      "'Love to laugh. Fluent in sarcasm. Looking for a partner in crime.' If your bio could be anyone's bio, it's no one's bio. Let's fix it.",
    category: "Profile Glow-Up",
    emoji: "✍️",
    color: "#BEF264",
    author: COACH,
    date: "2026-08-19",
    readMins: 5,
    blocks: [
      {
        type: "p",
        text: "Bios fail the same way openers fail: they're generic. 'I love travel, food, and good vibes' describes approximately every human alive. You've written a horoscope, not a bio.",
      },
      {
        type: "h2",
        text: "The banned phrases list",
      },
      {
        type: "list",
        items: [
          "'Partner in crime' — the crime is this bio.",
          "'Fluent in sarcasm' — sarcastic people don't announce it. That's the whole bit.",
          "'Love to laugh' — as opposed to whom? Name one person who hates laughing.",
          "'Just ask' — you had one job. The bio WAS the ask.",
          "'Not sure what I'm doing here lol' — insecurity as an opening statement.",
        ],
      },
      {
        type: "h2",
        text: "Specificity is the entire game",
      },
      {
        type: "p",
        text: "The rule from openers applies here too: if any of the other seven billion people could have written your bio, rewrite it. Swap categories for specifics. Not 'I love food' but 'ranking every dumpling spot in the city, currently at 23.' Not 'I like music' but 'will defend my claim that the bridge is the best part of every song.'",
      },
      {
        type: "example",
        good: "amateur pasta maker (emphasis on amateur), can parallel park on the first try 60% of the time, looking for someone to judge reality TV with at a professional level",
        bad: "Love travel, gym, food & good vibes. Fluent in sarcasm. Just ask!",
      },
      {
        type: "callout",
        title: "The opener test",
        text: "A great bio is a lay-up for openers. Read yours and ask: could a stranger write a fun first message off this? If it gives them nothing to grab, it's decoration, not a bio.",
      },
      {
        type: "h2",
        text: "The 3-beat structure that always works",
      },
      {
        type: "list",
        items: [
          "One concrete thing you're into (with a detail): 'training for a 10k, badly.'",
          "One self-aware flaw or bit: 'I will lose the argument but win the rematch I demand.'",
          "One tiny invitation: 'tell me your most irrational food opinion.'",
        ],
      },
      {
        type: "p",
        text: "Three lines. Specific, funny, answerable. It's the same formula as a good opener because a bio IS an opener — you're just sending it to everyone at once, so it has to be unmistakably yours.",
      },
      {
        type: "quote",
        text: "Generic bios attract generic conversations. You get the inbox you write for.",
      },
    ],
  },
  {
    slug: "first-date-playbook",
    title: "The First Date Playbook: 90 Minutes, Zero Interviews",
    excerpt:
      "Where to go, what to actually talk about, when to leave, and why 'dinner and a movie' is a rookie trap. Your complete first-date operating manual.",
    category: "First Dates",
    emoji: "🗓️",
    color: "#FDA4AF",
    author: COACH,
    date: "2026-09-21",
    readMins: 7,
    featured: true,
    blocks: [
      {
        type: "p",
        text: "You did it. You matched, you bantered, you closed for the date instead of pen-palling for three weeks. Now don't fumble it with a two-hour dinner interrogation under fluorescent lighting.",
      },
      {
        type: "h2",
        text: "Venue: drinks or coffee, 90 minutes, walkable",
      },
      {
        type: "list",
        items: [
          "Drinks or coffee, not dinner. Dinner locks you into 2+ hours with a stranger. A drink has a natural exit AND a natural extension.",
          "Pick a place YOU know. Home turf = you're relaxed, you know the menu, you're not both refreshing Google Maps.",
          "Somewhere you can hear each other. A club is not a date. It's a loud room with a cover charge.",
          "Bonus: pick a spot near a second location — a walk, a dessert place. If it's going well, 'there's a great gelato place around the corner' is the smoothest extension in the game.",
        ],
      },
      {
        type: "h2",
        text: "Conversation: stories, not resumes",
      },
      {
        type: "p",
        text: "The interview questions will try to escape your mouth. Where are you from, what do you do, how many siblings. Fine in small doses, but they're verification questions, not connection questions. Trade them for stories and takes.",
      },
      {
        type: "list",
        items: [
          "'What's the most chaotic thing that happened at your job this month?' beats 'what do you do?'",
          "'What's your most irrational fear?' beats 'so, any hobbies?'",
          "'What's the best terrible decision you've ever made?' beats literally anything about siblings.",
        ],
      },
      {
        type: "example",
        good: "ok important question: what's the pettiest hill you're willing to die on? I'll go first, fitted sheets are a two-person job and I don't care",
        bad: "So... what do you do for work? And where did you go to school? And what are your five-year goals?",
      },
      {
        type: "callout",
        title: "The 60/40 rule",
        text: "Aim to talk 40% and listen 60% — but ACTIVE listening. Callback something they said 20 minutes ago. Nothing signals 'I'm actually here' louder than remembering the small stuff.",
      },
      {
        type: "h2",
        text: "Leave on a high note",
      },
      {
        type: "p",
        text: "End the date at the peak, not after it. When there's a lull after a great stretch, that's your window: 'I've gotta head out, but this was genuinely fun.' Leaving at the high point means the last memory is a good one — and it beats squeezing the evening until it's dry.",
      },
      {
        type: "p",
        text: "If you want a second date, say so like a person: 'I'd do this again. I'll text you.' Then — and this is the crucial part — actually text them. Within 24 hours. Games are for the group chat.",
      },
      {
        type: "quote",
        text: "A first date has one job: find out if you want a second one. Everything else is noise.",
      },
    ],
  },
  {
    slug: "ghosted-comeback-plan",
    title: "Ghosted? Good. Here's Your Comeback Plan",
    excerpt:
      "Getting ghosted feels like a verdict on your worth. It isn't. It's a data point about them. Here's how to process it in 24 hours and come back sharper.",
    category: "Mindset",
    emoji: "👻",
    color: "#7DD3FC",
    author: COACH,
    date: "2026-08-30",
    readMins: 5,
    blocks: [
      {
        type: "p",
        text: "The conversation was great. The date was booked, or the vibe was building, and then — nothing. Read at 9:47 PM, followed by the loudest silence of your week. Welcome to the ghost zone. Everyone visits. Here's how to leave quickly.",
      },
      {
        type: "h2",
        text: "What ghosting actually means",
      },
      {
        type: "p",
        text: "Your brain will offer you a story: you said something wrong, you're not attractive enough, you fumbled it. Notice that every version makes it about you. Now consider the boring truth: ghosting is what people do when they can't handle a two-sentence honest conversation. That's a them-skill deficit, not a you-value deficit.",
      },
      {
        type: "list",
        items: [
          "They matched with someone else and can't multitask. Fine. You weren't in a relationship.",
          "They got busy and let it decay. Passive, but common.",
          "They were never that invested. The silence just made it visible sooner.",
          "They avoid all mild discomfort. You dodged years of that pattern.",
        ],
      },
      {
        type: "callout",
        title: "The 24-hour mourning window",
        text: "You get one day to be annoyed about a ghost. Feel it fully. Complain to one friend, maximum. Then it's closed. No re-reading the chat 'for clues'. Detectives get paid; you're doing it for free.",
      },
      {
        type: "h2",
        text: "What NOT to send",
      },
      {
        type: "example",
        good: "[nothing. or, if it was date-level established:] 'no worries if life got busy — door's open if you want to reschedule, otherwise good luck out there 🫡'",
        bad: "wow. okay. I see how it is. you know I actually thought you were different but I guess everyone on this app is the same",
      },
      {
        type: "p",
        text: "The paragraph of hurt feelings has never once summoned a ghost back to life. The unbothered exit line — sent once, or not at all — preserves the only thing that matters: your frame.",
      },
      {
        type: "h2",
        text: "The comeback protocol",
      },
      {
        type: "list",
        items: [
          "Don't let one ghost audit your whole self-image. One data point is not a dataset.",
          "Review honestly, once: was there a real miss (interviewing, pen-palling, no plan)? Note it, fix it, move.",
          "Keep the pipeline alive. The antidote to over-investing in one person is having options and a life.",
          "Protect the streak. Do today's lesson anyway. Momentum is the revenge.",
        ],
      },
      {
        type: "quote",
        text: "Ghosting says everything about their communication skills and nothing about your worth.",
      },
      {
        type: "p",
        text: "Still spiraling? Paste the chat into the Coach. Sometimes you need a third party to confirm: no, that message wasn't weird. They just folded. Next.",
      },
    ],
  },
  {
    slug: "dating-apps-arent-broken",
    title: "Hot Take: The Apps Aren't Broken. Your Strategy Is.",
    excerpt:
      "'Dating apps don't work anymore' is the most comfortable lie in modern dating. Comfortable, because it requires nothing from you. Let's get uncomfortable.",
    category: "Hot Takes",
    emoji: "🌶️",
    color: "#FDBA74",
    author: COACH,
    date: "2026-09-08",
    readMins: 6,
    blocks: [
      {
        type: "p",
        text: "Every week someone tells us 'the apps are dead.' And every week, people with sharp profiles and decent openers keep going on dates from those exact same dead apps. Both things can't be true. One of them isn't.",
      },
      {
        type: "h2",
        text: "The comfortable lie",
      },
      {
        type: "p",
        text: "Blaming the platform is painless. 'The algorithm buried me' asks nothing of you. 'My third photo is a blurry ceiling and my opener is hey' — that one stings, because it's fixable, and fixable means it was always your move.",
      },
      {
        type: "h2",
        text: "The uncomfortable audit",
      },
      {
        type: "list",
        items: [
          "Your photos: would YOU stop scrolling for them? Not 'are they accurate' — are they compelling?",
          "Your bio: does it give a stranger anything to open with, or is it three emojis and 'just ask'?",
          "Your openers: specific and playful, or copy-paste with the serial numbers filed off?",
          "Your texting: are you moving toward a date, or running a pen-pal program with benefits (no benefits)?",
          "Your volume: are you actually engaging, or swiping for dopamine at 1 AM and calling it effort?",
        ],
      },
      {
        type: "callout",
        title: "To be fair to you",
        text: "Yes — the apps are engineered for engagement, monetization is aggressive, and the free-tier experience got worse. All true. And none of it changes what's in your six photo slots. Play the hand, not the referee.",
      },
      {
        type: "h2",
        text: "What actually moves the needle",
      },
      {
        type: "p",
        text: "In our experience, roasting thousands of profiles and chats: the difference between 'apps don't work' and 'I have a date Thursday' is almost never looks. It's the boring fundamentals — photo one, opener quality, and closing for the date before the conversation flatlines. That's it. That's the meta.",
      },
      {
        type: "example",
        good: "Fix photo 1, delete the sunglasses collection, write 3 custom openers this week, propose a day by message five.",
        bad: "Redownload, swipe 400 times at midnight, send 'hey' 40 times, delete the app, post 'the apps are broken'.",
      },
      {
        type: "quote",
        text: "The app shows people your profile. It cannot make your profile interesting. Division of labor.",
      },
      {
        type: "p",
        text: "Disagree? Good — that's what hot takes are for. Vote on today's take in the Community tab and defend your position. Bring evidence.",
      },
    ],
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getRelatedArticles(article: Article, count = 3): Article[] {
  const sameCategory = ARTICLES.filter(
    (a) => a.slug !== article.slug && a.category === article.category,
  );
  const others = ARTICLES.filter(
    (a) => a.slug !== article.slug && a.category !== article.category,
  );
  return [...sameCategory, ...others].slice(0, count);
}

export const SORTED_ARTICLES = [...ARTICLES].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
);

export function formatArticleDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
