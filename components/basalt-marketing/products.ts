export type ProductId = 'crm' | 'onyx' | 'hq' | 'erp' | 'cms' | 'echo' | 'vigil';
export type SceneKind = 'network' | 'crystal' | 'constellation' | 'modules' | 'pages' | 'wave' | 'shield';
type Link = { label: string; href: string };
type Feature = { title: string; description: string; label: string };
type Walkthrough = { label: string; title: string; detail: string; rows: [string, string][]; note: string };
export type Product = {
    id: ProductId; name: string; suffix: string; accent: string; scene: SceneKind;
    eyebrow: string; headline: string; highlight: string; description: string; detail: string;
    primary: Link; secondary: Link; login?: Link; navigation: Link[]; notes: string[]; rails: string[];
    sceneLabel: string; featuresTitle: string; featuresDetail: string; features: Feature[];
    walkthrough: Walkthrough[]; workflowTitle: string; workflowDetail: string; steps: [string, string][];
    spotlight: { label: string; title: string; description: string; links: Link[] };
    questions: [string, string][]; finalTitle: string; finalHighlight: string; footer: Link[];
};

const commonNav = [{ label: 'Platform', href: '#platform' }, { label: 'How it works', href: '#workflow' }, { label: 'The Basalt family', href: '#ecosystem' }];
const commonFooter = [{ label: 'About BasaltHQ', href: 'https://basalthq.com/about' }, { label: 'Contact', href: 'https://basalthq.com/contact' }, { label: 'Privacy', href: 'https://basalthq.com/privacy' }, { label: 'Terms', href: 'https://basalthq.com/terms' }];

export const products: Record<ProductId, Product> = {
    crm: {
        id: 'crm', name: 'BasaltCRM', suffix: 'CRM', accent: '#52e6df', scene: 'network',
        eyebrow: 'A BETTER CONNECTION. A BETTER NEXT MOVE.', headline: 'Good relationships.', highlight: 'Great possibilities.',
        description: 'Your customer world, connected.\nYour next opportunity, in focus.',
        detail: 'Bring prospecting, outreach, and customer intelligence together. Give your team a clearer view of every relationship and a smarter way to move it forward.',
        primary: { label: 'Start growing', href: '/sign-in' }, secondary: { label: 'Explore the platform', href: '#platform' }, login: { label: 'Log in', href: '/sign-in' },
        navigation: [...commonNav.slice(0, 2), { label: 'Pricing', href: '/pricing' }, { label: 'Free tools', href: '#tools' }],
        notes: ['Free tools to get started', 'Jev decision intelligence'], rails: ['Discover the right leads', 'Keep conversations moving', 'See the bigger picture'], sceneLabel: 'THE LETTER THAT LEARNED TO FLY',
        featuresTitle: 'Less busywork.\nMore connection.', featuresDetail: 'From the first signal to the next conversation. Put your customer relationships at the center of the workflow.',
        features: [
            { label: 'DISCOVER', title: 'Find your next opportunity.', description: 'Bring company research, lead generation, and customer context into a single prospecting workflow.' },
            { label: 'ENGAGE', title: 'Keep the conversation going.', description: 'Coordinate outreach and AI-assisted sales and support agents with the information your team already has.' },
            { label: 'UNDERSTAND', title: 'Make a more informed move.', description: 'Jev decision intelligence helps you inspect buying intent, reply signals, and the reasoning behind the next action.' },
        ],
        walkthrough: [
            { label: 'Discover', title: 'A clearer starting point.', detail: 'Bring research and relationships into view.', rows: [['Company research', 'Context gathered'], ['Lead profile', 'Ready to review'], ['Next conversation', 'Your direction']], note: 'Find the fit before the first message.' },
            { label: 'Engage', title: 'Context in every conversation.', detail: 'Keep outreach connected to the customer record.', rows: [['Outreach draft', 'AI assisted'], ['Reply signal', 'Review intent'], ['Follow-up', 'Choose next action']], note: 'Your team stays in control of the next step.' },
            { label: 'Grow', title: 'See what moves the relationship.', detail: 'Turn customer signals into inspectable decisions.', rows: [['Buying intent', 'Inspect signals'], ['Customer sentiment', 'Review context'], ['Pipeline', 'Plan your next move']], note: 'Decision intelligence powered by Jev.' },
        ],
        workflowTitle: 'From first signal\nto lasting connection.', workflowDetail: 'A connected workflow gives every next step a little more context.',
        steps: [['Bring your world together', 'Connect customer records and the information your team needs.'], ['Find the right next step', 'Use research, conversation signals, and Jev insights to guide your work.'], ['Keep moving forward', 'Coordinate outreach, support, and follow-ups from one workspace.']],
        spotlight: { label: 'START WITH SOMETHING USEFUL', title: 'Small tools.\nA strong first impression.', description: 'Create a professional email signature or an embeddable form. Free business tools that help you start building better relationships.', links: [{ label: 'Build an email signature', href: '/signature' }, { label: 'Create a form', href: '/forms/embed' }] },
        questions: [['Can I start for free?', 'Yes. BasaltCRM has a Community Edition and free email signature and form tools. Visit pricing for current plan details.'], ['What is Jev decision intelligence?', 'Jev helps evaluate buying intent and reply signals so your team can inspect the context behind a suggested decision. It is included for every team.'], ['Can I use AI for sales and support?', 'BasaltCRM includes AI-assisted prospecting, outreach, and customer support workflows. Configure agents and review the controls inside your workspace.'], ['How do I choose the right setup?', 'Explore the features and pricing pages, or talk with the Basalt team about your customer workflow.']],
        finalTitle: 'Better relationships.', finalHighlight: 'Your next chapter.', footer: [{ label: 'Features', href: '/features' }, { label: 'AI agents', href: '/ai-agents' }, { label: 'Pricing', href: '/pricing' }, { label: 'Partners', href: '/partners' }, ...commonFooter],
    },
    onyx: {
        id: 'onyx', name: 'BasaltOnyx', suffix: 'ONYX', accent: '#c3a0ff', scene: 'crystal',
        eyebrow: 'SOCIAL INTELLIGENCE. HUMAN DIRECTION.', headline: 'Beyond the scroll.', highlight: 'Into possibility.',
        description: 'Create with intelligence. Engage with intent.\nGive your social world a center of gravity.',
        detail: 'Connect your networks, shape your strategy, and coordinate browser agents from one command center. The intelligence to act. The controls to make it yours.',
        primary: { label: 'Enter the workspace', href: '/underworld/gateway' }, secondary: { label: 'Explore the system', href: '#platform' }, login: { label: 'Log in', href: '/underworld/gateway' }, navigation: commonNav,
        notes: ['Onyx Node browser companion', 'Manual & scheduled control'], rails: ['X / Twitter & LinkedIn', 'Facebook & Instagram', 'Your voice. Your direction.'], sceneLabel: 'THE OBSERVATORY OF VOICES',
        featuresTitle: 'The intelligence to create.\nThe clarity to act.', featuresDetail: 'A platform-aware operation, built around the way your networks actually work.',
        features: [
            { label: 'INTELLIGENCE', title: 'Turn context into content.', description: 'Bring topics, brand voice, and conversations together. Create posts, threads, and visuals with AI assistance.' },
            { label: 'ORCHESTRATION', title: 'One command. Many moves.', description: 'Connect Onyx Node to your workspace. Coordinate browser tasks and track execution across supported networks.' },
            { label: 'AFTERLIFE', title: 'A different kind of energy.', description: 'Explore the signature red MYTHOS protocol. Configure the Afterlife task set while keeping workspace controls in your hands.' },
        ],
        walkthrough: [
            { label: 'Create', title: 'An idea, ready to take shape.', detail: 'Your voice and context guide the draft.', rows: [['Brand voice', 'Your direction'], ['Launch thread', 'Draft for review'], ['Post visual', 'AI assisted']], note: 'Shape the idea. Review the draft. Dispatch when ready.' },
            { label: 'Connect', title: 'Four worlds. One workspace.', detail: 'Use your connected social tabs through Onyx Node.', rows: [['X / Twitter', 'Content & conversations'], ['LinkedIn', 'Professional engagement'], ['Facebook / Instagram', 'Feed, stories & reels']], note: 'Capabilities depend on the platform and connection.' },
            { label: 'Control', title: 'You set the direction.', detail: 'Manual dispatch or scheduled operation.', rows: [['Task schedule', 'Your configuration'], ['Agent activity', 'Follow execution'], ['Activity log', 'Review results']], note: 'A clear view of what happens next.' },
        ],
        workflowTitle: 'Make your\nnext move count.', workflowDetail: 'Your strategy sets the course. Onyx brings the moving parts together.',
        steps: [['Connect your world', 'Link Onyx Node to your workspace and open your social accounts in the browser.'], ['Set the direction', 'Define your voice, choose your tasks, and shape the schedule around your strategy.'], ['Run the operation', 'Dispatch a command or follow your schedule. Track execution and results from one place.']],
        spotlight: { label: 'FOUR CONNECTED NETWORKS', title: 'Your social world.\nIn one orbit.', description: 'X for content and conversations. LinkedIn for professional presence. Facebook and Instagram for feed engagement, stories, and reels through Onyx Node.', links: [{ label: 'Open your command center', href: '/underworld/gateway' }] },
        questions: [['How does Onyx Node work?', 'Onyx Node is the Chrome and Edge browser companion. Connect it to your workspace and use your logged-in social tabs for supported platform tasks.'], ['Can I control when work runs?', 'Yes. Configure task frequencies, use scheduled operation, or dispatch individual actions manually. Track the work in your activity log.'], ['What changes in Afterlife mode?', 'Afterlife brings the signature red theme, MYTHOS protocol, and Afterlife task configuration to your workspace and browser companion. The preview on this page only changes the illustration.'], ['Are actions the same on every network?', 'Each network has its own supported tasks. Availability depends on the platform, your connection, and your configuration.']],
        finalTitle: 'Rise above the ordinary.', finalHighlight: 'Make your next move.', footer: [...commonFooter],
    },
    hq: {
        id: 'hq', name: 'BasaltHQ', suffix: 'HQ', accent: '#58adff', scene: 'constellation',
        eyebrow: 'ONE CONNECTED WORLD OF BUSINESS', headline: 'Big ideas.', highlight: 'Connected possibilities.',
        description: 'A suite that moves with your business.\nA clearer view of what comes next.',
        detail: 'Customers, operations, payments, content, and intelligence. Discover a family of purpose-built applications designed to bring your business world together.',
        primary: { label: 'Open your portal', href: '#portal' }, secondary: { label: 'Explore the Basalt family', href: '#ecosystem' }, navigation: [{ label: 'Our platform', href: '#platform' }, { label: 'Products', href: '#ecosystem' }, { label: 'Portal', href: '/portal' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }],
        notes: ['Purpose-built applications', 'One shared direction'], rails: ['Relationships & intelligence', 'Operations & commerce', 'Content & communication'], sceneLabel: 'THE LIVING ATLAS',
        featuresTitle: 'Every part of your business.\nA little more connected.', featuresDetail: 'Start with the tools you need. Build toward a bigger picture.',
        features: [
            { label: 'RELATIONSHIPS', title: 'Put people at the center.', description: 'Customer intelligence in CRM. Social intelligence in Onyx. Voice experiences in Echo. Better context for every conversation.' },
            { label: 'OPERATIONS', title: 'Give good work a better flow.', description: 'Bring modular operations in ERP together with payments and commerce in Surge. Help your teams move from insight to action.' },
            { label: 'INTELLIGENCE', title: 'See how it all fits.', description: 'A shared vision for business objects, relationships, and actions. Software that reflects the way your business actually works.' },
        ],
        walkthrough: [
            { label: 'Connect', title: 'A family with a common purpose.', detail: 'Find the application for your next chapter.', rows: [['CRM / Onyx', 'Customer & social context'], ['ERP / Surge', 'Operations & payments'], ['Echo / CMS', 'Voice & content']], note: 'Purpose-built tools. A consistent experience.' },
            { label: 'Understand', title: 'Make the connections visible.', detail: 'Think in business objects, relationships, and actions.', rows: [['People & customers', 'The relationships'], ['Products & resources', 'The operations'], ['Decisions & workflows', 'The next move']], note: 'Business context at the center of the system.' },
            { label: 'Build', title: 'Start where it matters.', detail: 'Shape a setup around the way you work.', rows: [['Explore the suite', 'Find your starting point'], ['Map your workflow', 'Bring the team together'], ['Plan your rollout', 'Talk with Basalt']], note: 'Your business sets the direction.' },
        ],
        workflowTitle: 'Your business.\nYour starting point.', workflowDetail: 'Choose a first step that solves something real, then build from there.',
        steps: [['Find your starting point', 'Explore the suite and choose the application that fits your most important workflow.'], ['Connect the bigger picture', 'Map the people, information, and operations that make your business work.'], ['Build your next chapter', 'Work with our team to shape a rollout around your needs.']],
        spotlight: { label: 'BUILT AROUND YOUR BUSINESS', title: 'A living picture.\nA practical next step.', description: 'Our vision brings business objects, relationships, and actions into a shared model. Explore the thinking behind the suite and what it can mean for your team.', links: [{ label: 'Read our vision', href: '/manifesto' }, { label: 'Explore solutions', href: '/solutions' }] },
        questions: [['Where should I start?', 'Choose the application that matches your immediate need, or talk with our team about the workflow you want to improve.'], ['Do I need the entire suite?', 'You can explore each product independently. Product capabilities, plans, and onboarding are explained on their own sites.'], ['What makes the applications a family?', 'The suite shares a vision for connected business context and a consistent visual experience, with each product focused on its own workflow.'], ['Can I talk with the team?', 'Yes. Visit our contact page to tell us about your business and the setup you have in mind.']],
        finalTitle: 'Your next big idea.', finalHighlight: 'A place to begin.', footer: [{ label: 'About', href: '/about' }, { label: 'Blog', href: '/blog' }, { label: 'Careers', href: '/careers' }, { label: 'Contact', href: '/contact' }, { label: 'Documentation', href: '/docs' }, { label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }],
    },
    erp: {
        id: 'erp', name: 'BasaltERP', suffix: 'ERP', accent: '#2bfff8', scene: 'modules',
        eyebrow: 'BETTER OPERATIONS, BY DESIGN', headline: 'All the moving parts.', highlight: 'One clearer picture.',
        description: 'Modular operations. Practical intelligence.\nBuilt around the way you work.',
        detail: 'Bring inventory, teams, reporting, and workflows into focus. Start with an industry pack and shape the system with an AI-assisted module builder.',
        primary: { label: 'Plan your demo', href: '/contact' }, secondary: { label: 'Explore the platform', href: '/features' }, navigation: [...commonNav.slice(0, 2), { label: 'Industries', href: '/industries' }, { label: 'Pricing', href: '/pricing' }],
        notes: ['Pre-built industry packs', 'AI-assisted module builder'], rails: ['Inventory & resources', 'Teams & workflows', 'Reporting & insight'], sceneLabel: 'THE GRAND WATERWORKS',
        featuresTitle: 'Less fragmentation.\nMore forward motion.', featuresDetail: 'A flexible foundation for the details that keep your business running.',
        features: [
            { label: 'CONNECT', title: 'Bring operations together.', description: 'Keep inventory, resources, teams, and reports in view. Reduce the gaps between the systems your business depends on.' },
            { label: 'CONFIGURE', title: 'Start with your industry.', description: 'Explore packs for restaurants, hospitality, retail, self-storage, child-care, and cannabis. Choose the starting point that fits.' },
            { label: 'EXTEND', title: 'Make room for your next idea.', description: 'Use the AI-assisted module builder to create or modify modules, panels, and workflows as your needs evolve.' },
        ],
        walkthrough: [
            { label: 'Connect', title: 'Your operation, in view.', detail: 'Bring the everyday moving parts together.', rows: [['Inventory', 'Stock & movements'], ['Team', 'Roles & access'], ['Reports', 'Operational context']], note: 'One workspace for a clearer operating picture.' },
            { label: 'Configure', title: 'A starting point that fits.', detail: 'Shape a pack around your industry workflow.', rows: [['Industry pack', 'Choose your foundation'], ['Operational modules', 'Configure the workflow'], ['Integrations', 'Connect your systems']], note: 'Build around your business.' },
            { label: 'Extend', title: 'Make the system your own.', detail: 'Describe the module you need to the builder.', rows: [['Module idea', 'Your requirements'], ['Panels & workflows', 'AI assisted'], ['Review & refine', 'Your direction']], note: 'A foundation with room to grow.' },
        ],
        workflowTitle: 'Built for today.\nReady for your next move.', workflowDetail: 'A modular approach keeps the setup connected to your actual needs.',
        steps: [['Choose your foundation', 'Start with an industry pack and the modules that matter to your operation.'], ['Bring the details together', 'Configure your inventory, teams, integrations, and reporting.'], ['Shape what comes next', 'Extend the system with AI-assisted modules as your workflow evolves.']],
        spotlight: { label: 'YOUR INDUSTRY. YOUR WAY OF WORKING.', title: 'A better fit.\nFrom the first module.', description: 'Restaurants, hospitality, retail, and beyond. Explore industry workflows and find the foundation for your operation.', links: [{ label: 'Explore industry packs', href: '/industries' }, { label: 'View plans', href: '/pricing' }] },
        questions: [['Which industries are supported?', 'Pre-built packs include restaurants, hospitality, retail, self-storage, child-care, and cannabis. Visit the industries page to explore the workflows.'], ['Can I customize the platform?', 'The AI-assisted module builder supports creating and modifying modules, panels, and workflows. Talk with the team about your setup.'], ['How does onboarding work?', 'Start with a guided demo so the team can understand your operation and help plan the right pack, modules, and integrations.'], ['Where can I see pricing?', 'Visit the pricing page for current plans and contact the team for your specific rollout.']],
        finalTitle: 'Better operations.', finalHighlight: 'More possibilities.', footer: [{ label: 'Features', href: '/features' }, { label: 'Industries', href: '/industries' }, { label: 'Pricing', href: '/pricing' }, { label: 'Integrations', href: '/integrations' }, { label: 'Docs', href: '/docs' }, ...commonFooter],
    },
    cms: {
        id: 'cms', name: 'BasaltCMS', suffix: 'CMS', accent: '#b7a5ff', scene: 'pages',
        eyebrow: 'MAKE SPACE FOR YOUR NEXT IDEA', headline: 'Great ideas.', highlight: 'Beautifully connected.',
        description: 'Your content. Your canvas.\nA simpler path from idea to experience.',
        detail: 'Bring visual page building, content, media, and AI assistance into one workspace. Create an experience that feels like you, with the tools to keep it moving.',
        primary: { label: 'Try the visual builder', href: '/demo' }, secondary: { label: 'Explore the features', href: '/features' }, login: { label: 'Log in', href: '/sign-in' }, navigation: [...commonNav.slice(0, 2), { label: 'Features', href: '/features' }, { label: 'Pricing', href: '/pricing' }],
        notes: ['Visual page building', 'AI-assisted content'], rails: ['Create the experience', 'Organize your content', 'Keep your brand connected'], sceneLabel: 'THE IMPOSSIBLE BOOK',
        featuresTitle: 'From a good idea\nto a great experience.', featuresDetail: 'Content and design belong in the same conversation.',
        features: [
            { label: 'COMPOSE', title: 'Build on a visual canvas.', description: 'Bring sections and content together with a visual builder. Shape the page around the story you want to tell.' },
            { label: 'ORGANIZE', title: 'Give content a home.', description: 'Manage media, documentation, forms, and website content in one workspace. Keep the pieces of your experience connected.' },
            { label: 'CREATE', title: 'Give your ideas momentum.', description: 'Use AI assistance to develop content and explore new directions while keeping your brand voice at the center.' },
        ],
        walkthrough: [
            { label: 'Compose', title: 'Your next page starts here.', detail: 'A visual approach to a connected experience.', rows: [['Hero section', 'Shape the opening'], ['Content blocks', 'Build the story'], ['Page layout', 'Review the experience']], note: 'Try the builder to explore the actual canvas.' },
            { label: 'Organize', title: 'Bring the pieces together.', detail: 'Content and media in one workspace.', rows: [['Media library', 'Your brand assets'], ['Documentation', 'Your knowledge'], ['Forms', 'Your connections']], note: 'Keep the next idea close to the context it needs.' },
            { label: 'Create', title: 'An idea with room to grow.', detail: 'Use AI assistance to develop the next draft.', rows: [['Brief', 'Your direction'], ['Draft', 'AI assisted'], ['Review', 'Your voice']], note: 'You shape the final experience.' },
        ],
        workflowTitle: 'A little less friction.\nA lot more creative room.', workflowDetail: 'Keep the path from idea to page clear.',
        steps: [['Start with your story', 'Gather the content and assets that make your brand yours.'], ['Shape the experience', 'Compose sections on the visual canvas and explore AI-assisted content.'], ['Review the bigger picture', 'Bring pages, media, and knowledge together in your workspace.']],
        spotlight: { label: 'YOUR NEXT IDEA HAS A CANVAS', title: 'Make something\nthat feels like you.', description: 'Explore the interactive visual builder and see how your content can come together.', links: [{ label: 'Open the builder demo', href: '/demo' }] },
        questions: [['Can I try the builder?', 'Yes. Open the builder demo to explore the interactive page canvas.'], ['What can I manage?', 'BasaltCMS brings page building, content, media, documentation, and forms into one workspace. Explore features for more detail.'], ['Is AI assistance available?', 'AI-assisted content workflows help develop drafts and ideas. Review and shape the result around your brand voice.'], ['How do I get started?', 'Try the visual demo, explore the features, or contact the team to plan your setup.']],
        finalTitle: 'Your next great idea.', finalHighlight: 'Ready to take shape.', footer: [{ label: 'Features', href: '/features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Support', href: '/support' }, { label: 'Contact', href: '/contact' }, ...commonFooter],
    },
    echo: {
        id: 'echo', name: 'BasaltEcho', suffix: 'ECHO', accent: '#ffc029', scene: 'wave',
        eyebrow: 'GOOD CONVERSATIONS OPEN POSSIBILITIES', headline: 'Your ideas.', highlight: 'In conversation.',
        description: 'Real-time conversations. Practical intelligence.\nA more natural way to connect.',
        detail: 'Bring AI voice assistants into your meetings, streams, and everyday work. Configure the context, choose the personality, and keep the conversation moving.',
        primary: { label: 'Open the voice console', href: '/console' }, secondary: { label: 'Explore plans', href: '/pricing' }, login: { label: 'Log in', href: '/login' }, navigation: [{ label: 'Platform', href: '#platform' }, { label: 'Live sessions', href: '/live' }, { label: 'Audio setup', href: '/audio-setup' }, { label: 'Pricing', href: '/pricing' }],
        notes: ['Configurable AI personalities', 'Real-time voice conversations'], rails: ['Voice & context', 'Meetings & live sessions', 'Your assistant. Your direction.'], sceneLabel: 'THE LISTENING WELL',
        featuresTitle: 'Less distance.\nMore conversation.', featuresDetail: 'Voice brings a different kind of connection to the work you do.',
        features: [
            { label: 'CONVERSE', title: 'Keep the conversation natural.', description: 'Real-time voice interactions with voice activity detection and WebRTC streaming. Talk through an idea while it is still taking shape.' },
            { label: 'CONFIGURE', title: 'Give your assistant context.', description: 'Choose domains, languages, styles, and expertise. Configure a personality around the conversation you want to have.' },
            { label: 'CONNECT', title: 'Meet your world where it is.', description: 'Bring AI voice into meetings, streams, and supported platforms. Explore live sessions and keep your profile connected.' },
        ],
        walkthrough: [
            { label: 'Configure', title: 'A voice with a little context.', detail: 'Shape the assistant around your conversation.', rows: [['Personality', 'Choose the style'], ['Knowledge domain', 'Set the context'], ['Language', 'Make it yours']], note: 'Your settings guide the conversation.' },
            { label: 'Converse', title: 'Make space for a good idea.', detail: 'A real-time voice experience from your console.', rows: [['Audio input', 'Choose your source'], ['AI assistant', 'Voice interaction'], ['Live session', 'Stay in the conversation']], note: 'Open the console to start a real session.' },
            { label: 'Connect', title: 'Take the conversation further.', detail: 'Meetings, streams, and your connected world.', rows: [['Platform connection', 'Choose the destination'], ['Public profile', 'Your presence'], ['Session activity', 'Explore what is live']], note: 'Review supported connections in the console.' },
        ],
        workflowTitle: 'From a first word\nto a new possibility.', workflowDetail: 'Give the assistant direction, then let the conversation take shape.',
        steps: [['Set the atmosphere', 'Choose your assistant personality, language, and area of expertise.'], ['Connect your audio', 'Use the audio setup guide to prepare your microphone and supported session sources.'], ['Start the conversation', 'Open the voice console and bring AI assistance into your next session.']],
        spotlight: { label: 'YOUR VOICE. YOUR WORLD.', title: 'A conversation\nworth joining.', description: 'Explore live sessions, discover the community, and prepare your audio setup for the next conversation.', links: [{ label: 'Explore live sessions', href: '/live' }, { label: 'Prepare your audio', href: '/audio-setup' }] },
        questions: [['How do I start a voice session?', 'Open the voice console, choose your assistant settings, and prepare your audio input. The audio setup page helps you configure your source.'], ['Can I customize the assistant?', 'Yes. Configure the domain, language, style, and expertise around the conversations you want to have.'], ['Where can I use it?', 'Explore supported meetings, streams, and platform connections in the console. Available integrations depend on your setup.'], ['How is usage priced?', 'Visit the pricing page for current usage options and plan details.']],
        finalTitle: 'A better conversation.', finalHighlight: 'A new possibility.', footer: [{ label: 'Voice console', href: '/console' }, { label: 'Live sessions', href: '/live' }, { label: 'Leaderboard', href: '/leaderboard' }, { label: 'Audio setup', href: '/audio-setup' }, { label: 'Pricing', href: '/pricing' }, ...commonFooter],
    },
    vigil: {
        id: 'vigil', name: 'BasaltVigil', suffix: 'VIGIL', accent: '#ff616c', scene: 'shield',
        eyebrow: 'LEGAL INTELLIGENCE. A CLEARER NEXT STEP.', headline: 'Complex work.', highlight: 'Clearer possibilities.',
        description: 'Specialist intelligence. Connected context.\nA more considered legal workflow.',
        detail: 'Bring research, document drafting, and corporate governance together. Coordinate specialist AI agents and keep the reasoning, the work, and the next step in view.',
        primary: { label: 'Open your workspace', href: '/chat' }, secondary: { label: 'Explore the platform', href: '/features' }, login: { label: 'Log in', href: '/login' }, navigation: [{ label: 'Platform', href: '#platform' }, { label: 'Features', href: '/features' }, { label: 'Industries', href: '/industries' }, { label: 'Pricing', href: '/pricing' }],
        notes: ['Specialist AI agents', 'Research, drafting & governance'], rails: ['Research & context', 'Documents & drafting', 'Governance & coordination'], sceneLabel: 'THE EVIDENCE VAULT',
        featuresTitle: 'More context.\nA more considered next move.', featuresDetail: 'Bring the moving parts of legal work into one connected workspace.',
        features: [
            { label: 'RESEARCH', title: 'Bring the context into focus.', description: 'Use specialist agents to explore legal research and case law. Keep the information close to the question you are working through.' },
            { label: 'DRAFT', title: 'Give the document a direction.', description: 'Develop contracts and legal documents with AI assistance. Shape drafts around your requirements and review the work in your workspace.' },
            { label: 'COORDINATE', title: 'Keep the bigger picture in view.', description: 'Bring corporate governance and legal operations together. Coordinate specialist agents around complex, connected workflows.' },
        ],
        walkthrough: [
            { label: 'Research', title: 'A question with the right context.', detail: 'Coordinate specialist research around your brief.', rows: [['Research brief', 'Your direction'], ['Case law', 'Explore context'], ['Findings', 'Review the work']], note: 'Inspect the context before deciding what comes next.' },
            { label: 'Draft', title: 'A clearer path to the first draft.', detail: 'Bring your requirements into the document workflow.', rows: [['Document brief', 'Define the requirements'], ['AI-assisted draft', 'Shape the language'], ['Review', 'Refine the document']], note: 'Your review guides the final document.' },
            { label: 'Coordinate', title: 'A connected legal operation.', detail: 'Keep specialist work in the same conversation.', rows: [['Agents', 'Coordinate expertise'], ['Documents', 'Keep the work connected'], ['Governance', 'See the next step']], note: 'One workspace for the bigger picture.' },
        ],
        workflowTitle: 'From a complex question\nto a clearer path.', workflowDetail: 'A connected workspace helps you keep the brief, the context, and the work together.',
        steps: [['Define the question', 'Bring your brief, document requirements, and business context into the workspace.'], ['Coordinate the expertise', 'Use specialist agents for research, drafting, and connected legal work.'], ['Review the next step', 'Inspect findings and drafts, refine the work, and keep your operation in view.']],
        spotlight: { label: 'SPECIALIST INTELLIGENCE. SHARED CONTEXT.', title: 'Complexity,\nwith a center of gravity.', description: 'Explore the platform and the thinking behind its legal constellation. Find a workflow that fits your organization.', links: [{ label: 'Explore the features', href: '/features' }, { label: 'Read our vision', href: '/vision' }] },
        questions: [['What can Vigil help with?', 'BasaltVigil brings AI-assisted legal research, document drafting, and corporate governance into a workspace coordinated by specialist agents.'], ['Can I work with documents?', 'Yes. Draft and develop legal documents around your brief, then review and refine the result in your workspace.'], ['How do specialist agents work together?', 'The platform coordinates specialist agents around the context and requirements of your legal workflow. Explore the features page for more detail.'], ['How do I get started?', 'Open your workspace, explore current pricing, or contact the team to discuss your organization.']],
        finalTitle: 'A clearer legal workflow.', finalHighlight: 'Your next chapter.', footer: [{ label: 'Features', href: '/features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Industries', href: '/industries' }, { label: 'Codex', href: '/codex' }, { label: 'Contact', href: '/contact' }, { label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }],
    },
};
