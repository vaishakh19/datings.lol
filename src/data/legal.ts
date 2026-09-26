// Content for the public legal pages (Privacy, Terms, Cookies, Disclaimer).
// Kept in one place so the LegalPage component can render any of them from a
// single data-driven layout. Update LAST_UPDATED whenever the copy changes.

export const LEGAL_LAST_UPDATED = "September 26, 2026";
export const LEGAL_CONTACT_EMAIL = "hello@datings.lol";
export const LEGAL_ENTITY = "datings.lol";

export interface LegalSection {
  heading: string;
  /** Paragraphs of body copy. */
  body?: string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: string[];
}

export interface LegalDoc {
  slug: string;
  /** Short label used in nav / footer. */
  label: string;
  /** Page <h1>. */
  title: string;
  /** One-line summary shown under the title. */
  intro: string;
  emoji: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms",
    label: "Terms of Service",
    title: "Terms of Service",
    emoji: "📜",
    intro:
      "The house rules. By using datings.lol you agree to these terms. Read them — they're mercifully short.",
    sections: [
      {
        heading: "1. Who we are & what this is",
        body: [
          "datings.lol (\"we\", \"us\", \"our\") is a self-improvement web app that provides daily dating lessons, an AI-powered chat coach, profile audits, streak tracking, and community features (the \"Service\").",
          "These Terms of Service (\"Terms\") form a binding agreement between you and datings.lol. If you do not agree to them, do not use the Service.",
        ],
      },
      {
        heading: "2. Eligibility",
        body: [
          "You must be at least 18 years old to use the Service. By using datings.lol you represent that you are 18 or older and legally able to enter into these Terms.",
          "The Service is intended for personal, non-commercial use only.",
        ],
      },
      {
        heading: "3. Your account",
        body: [
          "You are responsible for keeping your login credentials confidential and for all activity that happens under your account. Tell us immediately if you suspect unauthorized access.",
          "You agree to provide accurate information and to keep it up to date. We may suspend or terminate accounts that violate these Terms.",
        ],
      },
      {
        heading: "4. Advice is not professional advice",
        body: [
          "datings.lol delivers opinionated coaching, lessons, and AI-generated \"roasts\" for entertainment and educational purposes. It is not therapy, counseling, legal, medical, or professional relationship advice.",
          "You are solely responsible for your own decisions and conduct. Never rely on the Service in place of a qualified professional. See our Disclaimer for more.",
        ],
      },
      {
        heading: "5. Acceptable use",
        body: ["When using the Service, you agree not to:"],
        bullets: [
          "Harass, threaten, dox, or abuse other people, including anyone you discuss with the coach.",
          "Upload content that is unlawful, hateful, sexually exploitative, or that violates someone else's privacy or rights.",
          "Submit screenshots or messages of other people without a lawful basis to do so.",
          "Attempt to reverse-engineer, scrape, overload, or misuse the Service or its AI systems.",
          "Use the Service to manipulate, deceive, or harm others.",
        ],
      },
      {
        heading: "6. Your content",
        body: [
          "You keep ownership of the messages, screenshots, and profile details you submit (\"User Content\"). You grant us a limited license to process that content solely to operate and improve the Service — for example, sending it to our AI provider to generate a response.",
          "You are responsible for ensuring you have the right to share any User Content, including chats involving other people.",
        ],
      },
      {
        heading: "7. Free and paid plans",
        body: [
          "Some features are free with usage limits; others require an upgrade (\"Pro\"). Pricing and included features are described on the Pricing page and may change with notice.",
          "Where subscriptions are offered, they renew until cancelled and fees are non-refundable except where required by law.",
        ],
      },
      {
        heading: "8. Intellectual property",
        body: [
          "The Service, including its lessons, design, branding, and software, is owned by datings.lol and protected by intellectual property laws. We grant you a personal, non-transferable, revocable license to use it under these Terms.",
        ],
      },
      {
        heading: "9. Disclaimers & limitation of liability",
        body: [
          "The Service is provided \"as is\" and \"as available\" without warranties of any kind. We do not guarantee any particular outcome — dating results included.",
          "To the maximum extent permitted by law, datings.lol is not liable for any indirect, incidental, or consequential damages, or for decisions you make based on the Service.",
        ],
      },
      {
        heading: "10. Termination",
        body: [
          "You may stop using the Service at any time and delete your account. We may suspend or terminate access if you breach these Terms or misuse the Service.",
        ],
      },
      {
        heading: "11. Changes to these Terms",
        body: [
          "We may update these Terms from time to time. When we do, we'll revise the \"Last updated\" date. Continued use of the Service after changes take effect means you accept the updated Terms.",
        ],
      },
      {
        heading: "12. Contact",
        body: [
          `Questions about these Terms? Reach us at ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: "privacy",
    label: "Privacy Policy",
    title: "Privacy Policy",
    emoji: "🔒",
    intro:
      "What we collect, why we collect it, and the control you have over your data. No dark patterns.",
    sections: [
      {
        heading: "1. Overview",
        body: [
          "This Privacy Policy explains how datings.lol collects, uses, and protects your personal information when you use the Service. We aim to collect the minimum we need to run a useful product.",
        ],
      },
      {
        heading: "2. Information we collect",
        body: ["Depending on how you use the Service, we may collect:"],
        bullets: [
          "Account data: your username, email address, and password (stored only as a secure hash by our authentication provider).",
          "Profile & progress data: onboarding answers, goals, XP, streaks, badges, and lessons completed.",
          "Content you submit: chat messages, dating-app screenshots, and profile details you share with the AI coach.",
          "Usage data: interactions with the app such as which features you use and daily activity, used to power streaks and improve the product.",
          "Technical data: basic device and log information (like IP address and browser type) needed for security and reliability.",
        ],
      },
      {
        heading: "3. How we use your information",
        body: ["We use your information to:"],
        bullets: [
          "Provide, personalize, and maintain the Service (lessons, coaching, streaks, community).",
          "Generate AI responses to the content you submit.",
          "Keep your account secure and prevent abuse.",
          "Communicate with you about your account and important changes.",
          "Understand aggregate usage so we can improve the product.",
        ],
      },
      {
        heading: "4. AI processing",
        body: [
          "When you use the AI coach or profile audit, the content you submit (including any screenshots or messages) is sent to our third-party AI provider to generate a response. We instruct providers not to use this content to train their general models where such controls are available.",
          "Please avoid submitting sensitive personal information, or information about other people, that you don't have a right to share.",
        ],
      },
      {
        heading: "5. How your data is stored",
        body: [
          "Account, profile, and progress data are stored with our infrastructure providers (including our authentication and database provider). Some preferences and app state are also cached locally in your browser via local storage so the app works smoothly.",
          "We apply reasonable technical and organizational measures to protect your data, but no system is 100% secure.",
        ],
      },
      {
        heading: "6. Sharing your information",
        body: [
          "We do not sell your personal information. We share data only with service providers who help us operate the Service (such as hosting, database, authentication, and AI providers), and only as needed to perform their functions.",
          "We may also disclose information if required by law or to protect the rights, safety, and security of our users and the Service.",
        ],
      },
      {
        heading: "7. Your rights & choices",
        body: [
          "Depending on your location, you may have the right to access, correct, export, or delete your personal data, and to object to or restrict certain processing.",
        ],
        bullets: [
          "You can update your profile details from within the app.",
          "You can reset your local progress from the profile screen.",
          `You can request account deletion or exercise your rights by emailing ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: "8. Data retention",
        body: [
          "We retain your information for as long as your account is active or as needed to provide the Service. When you delete your account, we delete or anonymize your personal data within a reasonable period, except where we must retain it for legal reasons.",
        ],
      },
      {
        heading: "9. Children's privacy",
        body: [
          "The Service is not intended for anyone under 18, and we do not knowingly collect personal information from minors. If you believe a minor has provided us data, contact us and we will delete it.",
        ],
      },
      {
        heading: "10. International users",
        body: [
          "Your information may be processed in countries other than your own. Where we transfer data internationally, we take steps to ensure it receives an appropriate level of protection.",
        ],
      },
      {
        heading: "11. Changes to this policy",
        body: [
          "We may update this Privacy Policy from time to time. We'll revise the \"Last updated\" date and, for material changes, provide additional notice where appropriate.",
        ],
      },
      {
        heading: "12. Contact",
        body: [
          `For privacy questions or requests, email us at ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: "cookies",
    label: "Cookie Policy",
    title: "Cookie Policy",
    emoji: "🍪",
    intro:
      "How we use cookies and similar local storage technologies — and how you can control them.",
    sections: [
      {
        heading: "1. What are cookies?",
        body: [
          "Cookies are small text files stored on your device by your browser. Similar technologies — like local storage and session storage — let a site remember information between visits. We use \"cookies\" below to refer to all of these.",
        ],
      },
      {
        heading: "2. How we use them",
        body: ["datings.lol uses cookies and local storage to:"],
        bullets: [
          "Keep you signed in and maintain your session (essential).",
          "Remember your preferences and app state, like your streak, progress, and dismissed messages.",
          "Keep the Service secure and detect abuse.",
          "Understand aggregate usage so we can improve the product.",
        ],
      },
      {
        heading: "3. Types of cookies we use",
        body: [
          "Strictly necessary: required for the app to function, including authentication and security. These cannot be turned off within the app.",
          "Functional: remember your settings and local progress to give you a smoother experience.",
          "Analytics (if enabled): help us understand how features are used, in aggregate.",
        ],
      },
      {
        heading: "4. Third-party cookies",
        body: [
          "Some cookies may be set by the providers we rely on, such as our authentication and hosting partners, to deliver core functionality.",
        ],
      },
      {
        heading: "5. Managing cookies",
        body: [
          "Most browsers let you view, delete, and block cookies and clear local storage through their settings. Blocking strictly necessary cookies may break parts of the Service, such as staying signed in.",
          "You can also clear the app's local data from your profile screen inside the app.",
        ],
      },
      {
        heading: "6. Changes to this policy",
        body: [
          "We may update this Cookie Policy as our use of these technologies evolves. Please check the \"Last updated\" date for the latest version.",
        ],
      },
      {
        heading: "7. Contact",
        body: [
          `Questions about cookies? Email ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: "disclaimer",
    label: "Disclaimer",
    title: "Disclaimer",
    emoji: "⚠️",
    intro:
      "The important fine print about the advice, coaching, and AI content on datings.lol.",
    sections: [
      {
        heading: "1. For education & entertainment only",
        body: [
          "datings.lol provides dating lessons, opinionated coaching, and AI-generated \"roasts\" for educational and entertainment purposes. Nothing on the Service is professional advice.",
        ],
      },
      {
        heading: "2. Not a substitute for professionals",
        body: [
          "The Service is not therapy, counseling, or medical, legal, or financial advice, and it does not create a professional-client relationship. If you are struggling with your mental health or relationships, please consult a qualified professional.",
        ],
      },
      {
        heading: "3. AI-generated content",
        body: [
          "Coaching responses and audits are generated in part by artificial intelligence. AI can be wrong, biased, or out of date, and it may produce content that is inaccurate or inappropriate. Always use your own judgment before acting on anything the coach suggests.",
        ],
      },
      {
        heading: "4. No guaranteed results",
        body: [
          "Dating outcomes depend on many factors outside our control. We make no promises that using the Service will lead to matches, dates, relationships, or any specific result.",
        ],
      },
      {
        heading: "5. Your responsibility & the consent of others",
        body: [
          "You are solely responsible for how you act on any information from the Service, and for treating other people with respect, honesty, and consent. Never use the Service to harass, deceive, coerce, or harm anyone.",
        ],
      },
      {
        heading: "6. Crisis resources",
        body: [
          "datings.lol is not an emergency service. If you or someone else may be in danger or crisis, contact your local emergency number or a qualified crisis line immediately.",
        ],
      },
      {
        heading: "7. Contact",
        body: [
          `Questions about this disclaimer? Email ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
