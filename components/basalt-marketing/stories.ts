import type { ProductId } from './products';
type Chapter = { label: string; title: string; detail: string; visual: string; tags: string[] };
export type ProductStory = { title: string; introduction: string; chapters: [Chapter, Chapter, Chapter, Chapter] };

export const stories: Record<ProductId, ProductStory> = {
    crm: {
        title: 'The letter that learned to fly.',
        introduction: 'For the person building relationships, the next conversation matters more than another row in a database.',
        chapters: [
            { label: 'A question takes flight', title: 'One question. A world of possibility.', detail: 'A customer asks for an onboarding outline. Behind that simple message is a person, a company, and a history. Bring the information your team needs into the conversation.', visual: "A customer question leaves the cliff archive and dives into a wide world.", tags: ['The person behind the record', 'Research', 'Conversation history'] },
            { label: 'Understanding creates lift', title: 'Context changes how you show up.', detail: 'A shared profile brings the company, the contact, and the last conversation together. You can prepare with context, and a teammate can pick up the relationship without starting over.', visual: "At a distant context tower, contact, company, and conversation history join the wings.", tags: ['Prepare with context', 'A shared profile', 'Team continuity'] },
            { label: 'A considered response', title: 'Make the next message count.', detail: 'Inspect the customer’s reply and Jev’s reasoning beside the relationship. Shape a relevant response, then review it before sending. Your judgment gives the conversation its direction.', visual: "Across the cloud-filled gap, a solar-glass conservatory shelters the draft for review.", tags: ['Your judgment', 'Relevant outreach', 'A clear next step'] },
            { label: 'The conversation rises', title: 'Carry the relationship forward.', detail: 'Keep the response, the follow-up, and the support history close to the customer. The next person on your team can continue the conversation with an understanding of what came before.', visual: "A reply leaves the distant beacon and joins the original correspondence. The conversation travels forward.", tags: ['Follow through', 'Shared understanding', 'Lasting relationships'] },
        ],
    },
    onyx: {
        title: 'One voice. Many ways to be heard.',
        introduction: 'For the person responsible for a brand’s presence, turn a noisy feed into an operation you can deliberately direct.',
        chapters: [
            { label: 'Find a direction', title: 'The feed is busy. Your attention is finite.', detail: 'You have something to say, but topics, conversations, and competing ideas arrive all at once. Gather the context that matters before deciding what your audience needs.', visual: "An original message sits at the heart of a vast optical observatory.", tags: ['Audience context', 'Your attention', 'A starting point'] },
            { label: 'Shape the idea', title: 'The message should sound like you.', detail: 'Bring your brand voice and strategy into the workspace. Review and refine a draft with a clear idea of what you want people to take away from it.', visual: "The instrument focuses around the source. Your voice gives the message its shape.", tags: ['Brand voice', 'Your strategy', 'Draft review'] },
            { label: 'Respect the audience', title: 'Different places. Different conversations.', detail: 'Prepare platform-aware tasks for your connected accounts. Give each audience an appropriate version of the idea, with its own route through Onyx Node.', visual: "Three mounted editions frame the same idea for different audiences.", tags: ['X / Twitter', 'LinkedIn', 'Facebook / Instagram'] },
            { label: 'Keep the direction', title: 'You direct what happens next.', detail: 'Dispatch a task when you are ready or configure a schedule around your work. Follow the activity that comes back and use it to decide your next move.', visual: "The shutters open on the prepared editions. You direct what happens next.", tags: ['Manual dispatch', 'Your schedule', 'Activity in view'] },
        ],
    },
    hq: {
        title: 'A world built to work together.',
        introduction: 'A business is people, responsibilities, and decisions. Explore the Basalt family through the work it can help them do.',
        chapters: [
            { label: 'Start with a need', title: 'Someone on your team needs a better way.', detail: 'A salesperson preparing a call. An operator tracking resources. A creator shaping a page. Start with a concrete problem and the application built for that part of the work.', visual: "A carved stone threshold marks the beginning of a larger world.", tags: ['A real person', 'A specific need', 'A useful starting point'] },
            { label: 'See the handoffs', title: 'Their work touches someone else’s.', detail: 'The conversation informs the order. The order affects resources. The update needs an audience. Map the relationships between people and the work they pass along.', visual: "The doors open into a garden city, with a district for each kind of work.", tags: ['Team handoffs', 'Shared context', 'Business relationships'] },
            { label: 'Find a shared direction', title: 'Help the team see the same picture.', detail: 'Explore how information and decisions move through your operation. A connected business model can make dependencies and the next useful step easier to discuss.', visual: "Paths connect the districts around a shared courtyard.", tags: ['A common picture', 'Dependencies', 'Better conversations'] },
            { label: 'Grow deliberately', title: 'Build the next chapter with your team.', detail: 'Plan a rollout around how people actually work, then extend it as their needs change. Keep each application’s purpose clear within the broader direction of your business.', visual: "The view rises to reveal the connected city and its central portal.", tags: ['Your rollout', 'People first', 'Room to grow'] },
        ],
    },
    erp: {
        title: 'The work finds its rhythm.',
        introduction: 'Follow an operator’s work from disconnected details to a system shaped around the way their team gets things done.',
        chapters: [
            { label: 'See the moving parts', title: 'One change. Several people need to know.', detail: 'A resource moves, inventory changes, and a teammate needs an update. When those details live in separate systems, understanding the operation becomes its own job.', visual: "A marked resource enters the Grand Waterworks on a grounded conveyor.", tags: ['Inventory', 'Resources', 'Team coordination'] },
            { label: 'Make the work coherent', title: 'Start with a foundation your team understands.', detail: 'Choose an industry pack and configure the essential modules around your workflow. Give the people using the system a structure that reflects the work they recognize.', visual: "Water drives the wheel. Gates and rails align around the resource.", tags: ['Industry pack', 'Your workflow', 'A common foundation'] },
            { label: 'Fit the real workflow', title: 'Your team should not have to work around a gap.', detail: 'Use the AI-assisted module builder to shape what is missing. Review the extension against a real task before bringing it into the operation.', visual: "A mechanical switch guides the load through the configured workflow.", tags: ['A real task', 'Custom module', 'Review and refine'] },
            { label: 'Follow the change', title: 'Help the next person act with context.', detail: 'Bring the modules together and follow the movement through the operation to reporting. The person making the next decision can see the details behind the update.', visual: "The same load settles into its receiving cradle, with the route still visible.", tags: ['Connected workflow', 'Operational context', 'An informed next step'] },
        ],
    },
    cms: {
        title: 'Make a story people can step into.',
        introduction: 'Follow a creator from a collection of ingredients to a page that carries their story clearly to its audience.',
        chapters: [
            { label: 'Find the story', title: 'You have the ingredients. What should people feel?', detail: 'An image, a headline, a paragraph, a call to action. Bring the assets together and decide what the visitor should understand before arranging the page.', visual: "A monumental clothbound book opens beneath the garden glass.", tags: ['Your audience', 'Images and copy', 'A clear intention'] },
            { label: 'Give it a rhythm', title: 'Let the composition carry the idea.', detail: 'Shape the opening and arrange the sections on a visual canvas. Review the experience in the order a visitor encounters it, with the content close at hand.', visual: "Attached foldout pages arrange an idea into a deliberate composition.", tags: ['Visual canvas', 'Story order', 'Creative control'] },
            { label: 'Meet people where they are', title: 'The person reading may be on a phone.', detail: 'Review the composition at desktop, tablet, and mobile sizes. Adjust the balance so the idea stays understandable wherever someone encounters it.', visual: "Physical frames reveal the story at different reading formats.", tags: ['Desktop', 'Tablet', 'Mobile'] },
            { label: 'Share the next chapter', title: 'A finished page is the start of a conversation.', detail: 'Review the final experience and move toward publication. Keep the next version close so you can respond as your audience and your story develop.', visual: "The finished spread holds open for review and publication.", tags: ['Final review', 'Publication', 'A living story'] },
        ],
    },
    echo: {
        title: 'Room for a real conversation.',
        introduction: 'For the person thinking aloud, asking a question, or bringing people together, follow a voice into a useful exchange.',
        chapters: [
            { label: 'Say the first thing', title: 'An idea does not always arrive as a document.', detail: 'Sometimes it starts as a question spoken out loud. A microphone and voice activity give that thought a place in a live conversation.', visual: "One request ripples across the surface of a listening well.", tags: ['Audio input', 'Voice activity', 'A first idea'] },
            { label: 'Set the context', title: 'Bring the conversation into your world.', detail: 'Choose the assistant’s personality, language, and knowledge domain. Give the exchange a direction that fits what you are trying to think through.', visual: "Mounted context gates shape the exchange through an anchored acoustic instrument.", tags: ['Personality', 'Language', 'Knowledge domain'] },
            { label: 'Think together', title: 'A reply gives you something to build on.', detail: 'Listen, respond, and ask the next question while the thought is still developing. Real-time voice lets the exchange continue in both directions.', visual: "A measured answer returns across the basin toward its source.", tags: ['Listen', 'Respond', 'Keep the thought moving'] },
            { label: 'Bring people in', title: 'A conversation can become a shared session.', detail: 'Bring the assistant into supported meetings and streams. Give more people a way to join the exchange and develop the idea together.', visual: "The view widens to include shared listening terraces around the well.", tags: ['Meetings', 'Streams', 'Live sessions'] },
        ],
    },
    vigil: {
        title: 'Clarity through complexity.',
        introduction: 'For the person responsible for a careful legal workflow, follow a brief into specialist work they can inspect and refine.',
        chapters: [
            { label: 'Frame the real question', title: 'Someone needs a considered next step.', detail: 'Requirements, documents, and business context arrive together. Clarify the question and the constraints before deciding what the work needs to answer.', visual: "A monumental archive turns to retrieve the original brief.", tags: ['Your brief', 'Documents', 'Business context'] },
            { label: 'Coordinate the work', title: 'You should not have to hold every thread alone.', detail: 'Specialist agents bring research, drafting, and governance perspectives to shared context. Keep their roles visible as the work develops around your requirements.', visual: "The archive indexes each contribution. Supported carriers bring the original folios through the vault for inspection.", tags: ['Research', 'Drafting', 'Governance'] },
            { label: 'Make time for judgment', title: 'A draft needs more than a confident answer.', detail: 'Inspect the findings beside the document they inform. Review the language against your requirements and refine the draft with its context still in view.', visual: "The sources return to their archive as a connected dossier rises and opens for review.", tags: ['Findings', 'Draft', 'Your review'] },
            { label: 'Carry the context forward', title: 'Help the next person understand the matter.', detail: 'Keep the reviewed work, the specialist contributions, and the governance context connected. The next step begins with a clearer view of how the matter developed.', visual: "Full-height lattice gates close around the retained sources while the reviewed dossier remains in view.", tags: ['Connected documents', 'Continuity', 'A considered next step'] },
        ],
    },
};
