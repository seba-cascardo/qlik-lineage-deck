/*
 * Key phrases per scene for the presenter window: the "Decí" lines of storyboard.html v4, one note per line, word
 * for word, without the quotes the storyboard puts around every spoken line.
 * Not a script to read: reminders of what not to forget. A sentence that is also on screen starts with
 * "ON SCREEN:" (the presenter shows it in bold).
 * A line with a stage direction (the storyboard's <span class="note">: how to say it, not what to say) is an array
 * of segments: strings are spoken, { dir: "..." } is the direction (the presenter shows it dimmed, in italics).
 * A stage direction from another section of the storyboard (S03's "Datos": what to do if nobody answers in the chat)
 * is a note of its own, placed where it is needed; the line in quotes inside it is spoken.
 * qa/test_player.py (notes_word_for_word) compares every note with the storyboard.
 */
window.DECK_NOTES = {
  s01: [
    "I'm Sebastián, Qlik Specialist Technical Lead in the Visualisations team.",
    "The title says ‘from the ground up’. By the end you'll see that's meant quite literally."
  ],
  s02: [
    "Most of you know Qlik by name: it's the platform behind many of our dashboards.",
    "Each Qlik app is a dashboard plus a script that loads its data. Running that script is called a reload.",
    "Apps are published in streams. Think of a stream as a folder in the Qlik hub, where users find their apps.",
    "Some apps load straight from a database. Bigger products split the work: a generator app prepares the data and saves it as QVD files, Qlik's own data format, a table saved to disk that's very fast to reuse. The front end reads those QVDs, and it's what users open.",
    "The QVDs live in containers: each project's folder on the server.",
    "Like a kitchen and a dining room: one prepares, the other serves. Together they make one product."
  ],
  s03: [
    "With that vocabulary, a quick question. Two QVD files from our servers. Which one can we delete? Type A or B in the chat.",
    [{ dir: "Si en 10 segundos nadie contesta, lo resolvés vos:" }, "I'd have said A too."],
    "If you went for A, you're in good company. It's old, it's big, and nobody has touched it in almost two years.",
    "But A is read every morning by a dashboard that compares this year with 2024. B is rewritten every night by a generator, and nobody reads it.",
    "ON SCREEN: Age tells you when a file was written. Not whether anyone still needs it.",
    "Keep file B in mind. We'll come back to it."
  ],
  s04: [
    "We're not short of data. We already have a large app called Environment Auditor: it analyses apps, reloads, sessions, telemetry and data models, and it's genuinely useful.",
    "It knows a lot about every app. One app at a time.",
    "We can even tell generators from front ends, by their stream or by a tag in the admin console. What we couldn't see was which generator feeds which front end.",
    "And files, containers and connections were islands of their own: no bridge to the apps that use them.",
    "And we have all of this three times: on-prem, GCP and AWS.",
    "ON SCREEN: Lots of information. Few relationships."
  ],
  s05: [
    "That left us with four questions we couldn't answer.",
    "Is it still used? We know every file's size and date, but not who reads it. The same goes for data connections and project folders.",
    "What belongs together? We knew which apps were generators and which were front ends, but not which one feeds which.",
    "Does it follow the rules? Our template asks every app to declare whether it holds PII data, and its security classification. We had no easy way to check.",
    ["Who owns it? In Production, apps aren't published by the people who build them: the Ops team moves them, using a technical account. So, according to Qlik, every app in Production has the same owner:",
      { dir: "(clic: aparece «Owner: a technical account»)" }, "that account.", { dir: "(con cara seria, y pausa)" }]
  ],
  s06: [
    "This is the map we need: every app tied to its files, its folders and its connections; generators tied to their front ends; and one owner per stream.",
    "It matters. We usually run with less than 100 GB of free space. Some old files may hold personal data that our retention policy says should be gone. And owners can't see the Production folders, because Ops moves the data. We were asking people to tidy a room with the lights off.",
    "We started with the people side: Ops is going stream by stream to give each one a single owner. The dashed lines, the lineage, looked out of reach."
  ],
  s07: [
    "The breakthrough didn't start with a lineage project. It started with a much smaller request.",
    "We were migrating our on-premise databases to Azure, and nobody wanted to migrate connections that nothing used.",
    "Qlik tells you which connections exist. Not which ones are used.",
    "A colleague mentioned a dashboard that did exactly that. We installed a copy, and it worked.",
    [{ dir: "(pausa)" }, "And I got curious. How did it know?", { dir: "Es la única vez que el «I» pesa." }]
  ],
  s08: [
    "Every time a Qlik app reloads, it writes a log: a diary of everything it did, line by line.",
    "Whenever a script connects to a database, it has to say so: ‘LIB CONNECT TO’, followed by the connection name.",
    "The dashboard read every diary, found those lines, and wrote down who connected to what, and when.",
    "ON SCREEN: It didn't find the list. It built it.",
    "That's the ‘ground’ in the title. We didn't start from a report. We started from the lowest layer the platform has, one line at a time."
  ],
  s09: [
    "Once you see that, the next question is obvious: if the diary records connections, what else does it record?",
    "Every file an app saves. Every file it reads. Every variable it sets.",
    "A generator saves a file, a front end reads it: now we know they belong together. Those are the bridges we were missing.",
    "One limitation: Qlik keeps logs for two months. We've been keeping our own copy, so we already see four months, and it grows every month. And an app that hasn't reloaded in four months is a finding in itself: we don't run quarterly or yearly apps."
  ],
  s10: [
    "Back to the four questions. I'll leave ownership for last, because that's where all of this is heading."
  ],
  s11: [
    "Across the three environments we hold almost 124,000 QVD files in Production: 2.8 terabytes.",
    "Only about 2,800 of those files are read by apps people actually use. Two percent.",
    "By size, that leaves 2.1 terabytes with no valid use: files read only by apps nobody opens, files written and never read, and a full terabyte with no sign of use at all.",
    "We don't delete on usage alone. The first round is what's both unused and unchanged for six months: 1.28 terabytes, about 67,000 files, and owners review them first.",
    "For context, we usually run with less than 100 GB free.",
    "And remember the puzzle? Age alone gets it wrong both ways. 84 files older than six months are still read by live products: delete by age, and you break them. And 0.2 terabytes are written every night and never read. None of them is older than six months, so an age rule would never find them.",
    "It isn't only about space, either. In GCP alone, 471 files come from apps that declare PII data and are over two years old. Not every file of a PII app holds personal data, so each one needs checking, but that's exactly the list a retention review needs."
  ],
  s12: [
    "This is where it all started: the Azure migration.",
    "On-prem Production has 203 data connections. 114 weren't used at all in the last three months. Another 22 only feed apps nobody opens.",
    "So only 67 of 203 serve apps people use. Those are the real candidates to migrate.",
    "Same story for project folders: 37 containers with no activity."
  ],
  s13: [
    "Now that we know who saves what and who reads it, apps group themselves into products.",
    "We have 3,562 apps in Production. 1,779 of them work together, and they collapse into 587 products, about three apps each. Another 621 are standalone: products of one.",
    "And 1,162 apps haven't reloaded in four months: candidates to decommission in their own right.",
    "Some generators feed nothing. 800 of them, 44%, produce files that nobody seems to read. A few are legitimate, like backups. Most are leftovers of decommissions that were never finished: the dashboard was retired, but the kitchen still cooks. That's where file B came from.",
    "In September alone, those generators reloaded 37,290 times. That's 29% of all generator reloads, more than 1,200 a day."
  ],
  s14: [
    "This also changed how we measure cost.",
    "An app reading straight from a database looked like our heaviest. A front end reading QVDs looked almost free, because its real cost sat in generators, in another stream.",
    "Once we group them into products, the picture flips.",
    "ON SCREEN: We weren't measuring products. We were measuring pieces of them."
  ],
  s15: [
    "Our template asks every app to declare two things: whether it holds PII data, and its security classification.",
    "The diary records variables, so now we can check that, app by app.",
    "Instead of assuming compliance, we get a list: 83 apps in Production that don't follow the template [out of N]."
  ],
  s16: [
    "All of this leads to one place: the Owners Dashboard.",
    "Every stream gets one accountable owner. With section access, each owner sees only what's theirs: their streams and apps, their containers and files, and what's used and what isn't.",
    "Today owners can't even see what's in Production, because Ops moves the files. This changes that, and it's how we keep our environments clean over time.",
    "And every month, each owner gets an email with their recommended action items.",
    "It's in early construction. I'm building the data model; Ops is finding an owner for every stream and splitting the ones that have several. With this many legacy streams it's slow work, but it's moving.",
    "ON SCREEN: The dashboard won't make decisions for owners. It makes the missing decisions visible."
  ],
  s17: [
    "That's the map we didn't have: every island connected, and someone responsible for each part."
  ],
  s18: [
    "There's an old puzzle about walking through a city across its seven bridges, crossing each one only once. In 1736, Euler solved it by ignoring the map and keeping only the land and the bridges: dots and lines.",
    "The answer was no, it can't be done. But that way of thinking became graph theory, and it's how we draw lineage today.",
    "Our question was just as ordinary: which connections don't we need to migrate? The answer was a list. The method gave us a map.",
    "We didn't invent anything. Qlik writes the logs, a colleague pointed us to a dashboard, and someone else had written it. What we did was ask how it worked.",
    "ON SCREEN: Sometimes the answer is the smaller part of what you find."
  ],
  s19: [
    "Thank you. Happy to take questions."
  ]
};
