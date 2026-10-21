# Qlik Estate Rationalisation — speech notes

Key ideas and phrases per scene, not a script. Same notes as the presenter window (key N).
*Italics* = stage direction. **ON SCREEN** = the sentence is on the slide too.

Keys: → / PageDown next · ← back · Space pause a sequence · B black screen · N presenter window · T reset the clock · P fps meter.

## S01 · Title

Starts at **0:00** · 0 clicks

- I'm Sebastián, Qlik Specialist Technical Lead in the Visualisations team.
- The title says ‘from the ground up’. By the end you'll see that's meant quite literally.

## S02 · Qlik in 90 seconds

Starts at **0:20** · 5 clicks

- Most of you know Qlik by name: it's the platform behind many of our dashboards.
- Each Qlik app is a dashboard plus a script that loads its data. Running that script is called a reload.
- Apps are published in streams. Think of a stream as a folder in the Qlik hub, where users find their apps.
- Some apps load straight from a database. Bigger products split the work: a generator app prepares the data and saves it as QVD files, Qlik's own data format, a table saved to disk that's very fast to reuse. The front end reads those QVDs, and it's what users open.
- The QVDs live in containers: each project's folder on the server.
- Like a kitchen and a dining room: one prepares, the other serves. Together they make one product.

## S03 · Which one can we delete?

Starts at **1:50** · 4 clicks

- With that vocabulary, a quick question. Two QVD files from our servers. Which one can we delete? Type A or B in the chat.
- *Si en 10 segundos nadie contesta, lo resolvés vos:* I'd have said A too.
- If you went for A, you're in good company. It's old, it's big, and nobody has touched it in almost two years.
- But A is read every morning by a dashboard that compares this year with 2024. B is rewritten every night by a generator, and nobody reads it.
- **ON SCREEN:** Age tells you when a file was written. Not whether anyone still needs it.
- Keep file B in mind. We'll come back to it.

## S04 · We weren't short of data

Starts at **2:50** · 2 clicks

- We're not short of data. We already have a large app called Environment Auditor: it analyses apps, reloads, sessions, telemetry and data models, and it's genuinely useful.
- It knows a lot about every app. One app at a time.
- We can even tell generators from front ends, by their stream or by a tag in the admin console. What we couldn't see was which generator feeds which front end.
- And files, containers and connections were islands of their own: no bridge to the apps that use them.
- And we have all of this three times: on-prem, GCP and AWS.
- **ON SCREEN:** Lots of information. Few relationships.

## S05 · Four questions we couldn't answer

Starts at **3:35** · 5 clicks

> 5 clicks: the 4 questions, then one more for the punchline (cogs + “Owner: a technical account”).

- That left us with four questions we couldn't answer.
- Is it still used? We know every file's size and date, but not who reads it. The same goes for data connections and project folders.
- What belongs together? We knew which apps were generators and which were front ends, but not which one feeds which.
- Does it follow the rules? Our template asks every app to declare whether it holds PII data, and its security classification. We had no easy way to check.
- Who owns it? In Production, apps aren't published by the people who build them: the Ops team moves them, using a technical account. So, according to Qlik, every app in Production has the same owner: *(clic: aparece «Owner: a technical account»)* that account. *(con cara seria, y pausa)*

## S06 · The map we need

Starts at **4:50** · 1 click

- This is the map we need: every app tied to its files, its folders and its connections; generators tied to their front ends; and one owner per stream.
- It matters. We usually run with less than 100 GB of free space. Some old files may hold personal data that our retention policy says should be gone. And owners can't see the Production folders, because Ops moves the data. We were asking people to tidy a room with the lights off.
- We started with the people side: Ops is going stream by stream to give each one a single owner. The dashed lines, the lineage, looked out of reach.

## S07 · Then came a smaller question

Starts at **5:30** · 4 clicks

- The breakthrough didn't start with a lineage project. It started with a much smaller request.
- We were migrating our on-premise databases to Azure, and nobody wanted to migrate connections that nothing used.
- Qlik tells you which connections exist. Not which ones are used.
- A colleague mentioned a dashboard that did exactly that. We installed a copy, and it worked.
- *(pausa)* And I got curious. How did it know? *Es la única vez que el «I» pesa.*

## S08 · The answer was in the diary

Starts at **6:30** · 6 clicks

- Every time a Qlik app reloads, it writes a log: a diary of everything it did, line by line.
- Whenever a script connects to a database, it has to say so: ‘LIB CONNECT TO’, followed by the connection name.
- The dashboard read every diary, found those lines, and wrote down who connected to what, and when.
- **ON SCREEN:** It didn't find the list. It built it.
- That's the ‘ground’ in the title. We didn't start from a report. We started from the lowest layer the platform has, one line at a time.

## S09 · One clue became a method

Starts at **8:30** · 5 clicks

- Once you see that, the next question is obvious: if the diary records connections, what else does it record?
- Every file an app saves. Every file it reads. Every variable it sets.
- A generator saves a file, a front end reads it: now we know they belong together. Those are the bridges we were missing.
- One limitation: Qlik keeps logs for two months. We've been keeping our own copy, so we already see four months, and it grows every month. And an app that hasn't reloaded in four months is a finding in itself: we don't run quarterly or yearly apps.

## S10 · Back to our four questions

Starts at **10:15** · 2 clicks

- Back to the four questions. I'll leave ownership for last, because that's where all of this is heading.

## S11 · Is it still used? Data files

Starts at **10:30** · 7 clicks

> On screen the sizes are in GB: 2,780 GB in total · first round 1,278 GB (488 + 790) · 210 GB written, never read.

- Across the three environments we hold almost 124,000 QVD files in Production: 2.8 terabytes.
- Only about 2,800 of those files are read by apps people actually use. Two percent.
- By size, that leaves 2.1 terabytes with no valid use: files read only by apps nobody opens, files written and never read, and a full terabyte with no sign of use at all.
- We don't delete on usage alone. The first round is what's both unused and unchanged for six months: 1.28 terabytes, about 67,000 files, and owners review them first.
- For context, we usually run with less than 100 GB free.
- And remember the puzzle? Age alone gets it wrong both ways. 84 files older than six months are still read by live products: delete by age, and you break them. And 0.2 terabytes are written every night and never read. None of them is older than six months, so an age rule would never find them.
- It isn't only about space, either. In GCP alone, 471 files come from apps that declare PII data and are over two years old. Not every file of a PII app holds personal data, so each one needs checking, but that's exactly the list a retention review needs.

## S12 · Is it still used? Connections and containers

Starts at **12:15** · 5 clicks

- This is where it all started: the Azure migration.
- On-prem Production has 203 data connections. 114 weren't used at all in the last three months. Another 22 only feed apps nobody opens.
- So only 67 of 203 serve apps people use. Those are the real candidates to migrate.
- Same story for project folders: 37 containers with no activity.

## S13 · What belongs together? Products

Starts at **13:00** · 4 clicks

- Now that we know who saves what and who reads it, apps group themselves into products.
- We have 3,562 apps in Production. 1,779 of them work together, and they collapse into 587 products, about three apps each. Another 621 are standalone: products of one.
- And 1,162 apps haven't reloaded in four months: candidates to decommission in their own right.
- Some generators feed nothing. 800 of them, 44%, produce files that nobody seems to read. A few are legitimate, like backups. Most are leftovers of decommissions that were never finished: the dashboard was retired, but the kitchen still cooks. That's where file B came from.
- In September alone, those generators reloaded 37,290 times. That's 29% of all generator reloads, more than 1,200 a day.

## S14 · Measured as products

Starts at **14:15** · 4 clicks

- This also changed how we measure cost.
- An app reading straight from a database looked like our heaviest. A front end reading QVDs looked almost free, because its real cost sat in generators, in another stream.
- Once we group them into products, the picture flips.
- **ON SCREEN:** We weren't measuring products. We were measuring pieces of them.

## S15 · Does it follow the rules?

Starts at **15:00** · 3 clicks

- Our template asks every app to declare two things: whether it holds PII data, and its security classification.
- The diary records variables, so now we can check that, app by app.
- Instead of assuming compliance, we get a list: 83 apps in Production that don't follow the template [out of N].

## S16 · Who owns it? The Owners Dashboard

Starts at **15:40** · 6 clicks

- All of this leads to one place: the Owners Dashboard.
- Every stream gets one accountable owner. With section access, each owner sees only what's theirs: their streams and apps, their containers and files, and what's used and what isn't.
- Today owners can't even see what's in Production, because Ops moves the files. This changes that, and it's how we keep our environments clean over time.
- And every month, each owner gets an email with their recommended action items.
- It's in early construction. I'm building the data model; Ops is finding an owner for every stream and splitting the ones that have several. With this many legacy streams it's slow work, but it's moving.
- **ON SCREEN:** The dashboard won't make decisions for owners. It makes the missing decisions visible.

## S17 · The map we didn't have

Starts at **17:15** · 1 click

- That's the map we didn't have: every island connected, and someone responsible for each part.

## S18 · Dots and lines

Starts at **17:45** · 3 clicks

> Last click: the graph travels into the Vodafone logo and “Together we can” appears.

- There's an old puzzle about walking through a city across its seven bridges, crossing each one only once. In 1736, Euler solved it by ignoring the map and keeping only the land and the bridges: dots and lines.
- The answer was no, it can't be done. But that way of thinking became graph theory, and it's how we draw lineage today.
- Our question was just as ordinary: which connections don't we need to migrate? The answer was a list. The method gave us a map.
- We didn't invent anything. Qlik writes the logs, a colleague pointed us to a dashboard, and someone else had written it. What we did was ask how it worked.
- **ON SCREEN:** Sometimes the answer is the smaller part of what you find.

## S19 · End frame

Starts at **19:00** · 1 click

> Heads-up: the first click into S19 changes nothing on screen (S18 already ends on S19's first frame); the next one fills the logo and shows “Questions?”.

- Thank you. Happy to take questions.

