/** Curated IDs are permanent. Names/aliases can change without splitting a stack.
 * Icons are fetched ONLY at build time from these trusted sources. No public URL fetcher.
 * Fallback glyphs are from Font Awesome Brands (CC BY 4.0); see BRAND-ASSETS.md.
 */
const definitions = [
  ['jira', 'Jira', 'Product & design', 'atlassian.com/software/jira', '#1868DB', 'faJira', 'atlassian agile tickets backlog'],
  ['figma', 'Figma', 'Product & design', 'figma.com', '#A259FF', 'faFigma', 'figjam design prototype'],
  ['github', 'GitHub', 'Development', 'github.com', '#24292F', 'faGithub', 'git code pull requests'],
  ['netlify', 'Netlify', 'Development', 'netlify.com', '#087F8C', '', 'hosting deploy jamstack'],
  ['notion', 'Notion', 'Productivity', 'notion.so', '#191919', '', 'notes docs wiki'],
  ['slack', 'Slack', 'Communication', 'slack.com', '#611F69', 'faSlack', 'chat messaging'],
  ['linear', 'Linear', 'Product & design', 'linear.app', '#5E6AD2', '', 'issues tickets planning'],
  ['vercel', 'Vercel', 'Development', 'vercel.com', '#191919', '', 'hosting next nextjs deploy'],
  ['chatgpt', 'ChatGPT', 'AI', 'chatgpt.com', '#167D65', '', 'openai ai assistant'],
  ['claude', 'Claude', 'AI', 'claude.ai', '#B86243', '', 'anthropic ai assistant'],
  ['gemini', 'Gemini', 'AI', 'gemini.google.com', '#4386F4', 'faGoogle', 'google ai assistant'],
  ['perplexity', 'Perplexity', 'AI', 'perplexity.ai', '#207A7F', '', 'ai search research'],
  ['gmail', 'Gmail', 'Communication', 'mail.google.com', '#C83732', 'faGoogle', 'google email mail'],
  ['outlook', 'Outlook', 'Communication', 'outlook.office.com', '#1264BA', 'faMicrosoft', 'microsoft email mail'],
  ['google-drive', 'Google Drive', 'Productivity', 'drive.google.com', '#23864A', 'faGoogleDrive', 'google docs sheets files'],
  ['google-calendar', 'Google Calendar', 'Productivity', 'calendar.google.com', '#2868D8', 'faGoogle', 'calendar diary meetings'],
  ['microsoft-teams', 'Microsoft Teams', 'Communication', 'teams.microsoft.com', '#6264A7', 'faMicrosoft', 'meetings chat teams'],
  ['zoom', 'Zoom', 'Communication', 'zoom.us', '#2474ED', '', 'meetings video calls'],
  ['trello', 'Trello', 'Productivity', 'trello.com', '#176DE6', 'faTrello', 'atlassian boards kanban'],
  ['asana', 'Asana', 'Productivity', 'asana.com', '#D95162', '', 'tasks planning projects'],
  ['airtable', 'Airtable', 'Productivity', 'airtable.com', '#DAA521', '', 'database spreadsheet no code'],
  ['miro', 'Miro', 'Product & design', 'miro.com', '#625F31', '', 'whiteboard collaboration'],
  ['canva', 'Canva', 'Product & design', 'canva.com', '#16868C', '', 'design presentations graphics'],
  ['framer', 'Framer', 'Product & design', 'framer.com', '#1468ED', '', 'website design'],
  ['webflow', 'Webflow', 'Product & design', 'webflow.com', '#1468ED', 'faWebflow', 'website design no code'],
  ['confluence', 'Confluence', 'Productivity', 'atlassian.com/software/confluence', '#1868DB', 'faConfluence', 'atlassian docs wiki'],
  ['cloudflare', 'Cloudflare', 'Development', 'cloudflare.com', '#CD7214', 'faCloudflare', 'workers dns hosting d1'],
  ['aws', 'AWS', 'Development', 'aws.amazon.com', '#B9700B', 'faAws', 'amazon web services cloud'],
  ['supabase', 'Supabase', 'Development', 'supabase.com', '#21885B', '', 'database postgres backend'],
  ['gitlab', 'GitLab', 'Development', 'gitlab.com', '#D05F22', 'faGitlab', 'code git pipelines'],
  ['bitbucket', 'Bitbucket', 'Development', 'bitbucket.org', '#1868DB', 'faBitbucket', 'atlassian git code'],
  ['codepen', 'CodePen', 'Development', 'codepen.io', '#24292F', 'faCodepen', 'code prototype css'],
  ['sentry', 'Sentry', 'Development', 'sentry.io', '#5B3E60', '', 'errors monitoring'],
  ['postman', 'Postman', 'Development', 'postman.com', '#D36635', '', 'api requests testing'],
  ['replit', 'Replit', 'Development', 'replit.com', '#C55320', '', 'code ai development'],
  ['lovable', 'Lovable', 'AI', 'lovable.dev', '#AD456E', '', 'ai development vibe coding'],
  ['salesforce', 'Salesforce', 'Business', 'salesforce.com', '#087FB1', 'faSalesforce', 'crm sales'],
  ['hubspot', 'HubSpot', 'Business', 'hubspot.com', '#BF542E', 'faHubspot', 'crm sales marketing'],
  ['stripe', 'Stripe', 'Business', 'stripe.com', '#635BFF', 'faStripe', 'payments billing'],
  ['shopify', 'Shopify', 'Business', 'shopify.com', '#51852B', 'faShopify', 'shop ecommerce'],
  ['wordpress', 'WordPress', 'Business', 'wordpress.com', '#21759B', 'faWordpress', 'blog website cms'],
  ['mailchimp', 'Mailchimp', 'Business', 'mailchimp.com', '#555127', 'faMailchimp', 'email marketing'],
  ['dropbox', 'Dropbox', 'Productivity', 'dropbox.com', '#1265DD', 'faDropbox', 'files storage'],
  ['linkedin', 'LinkedIn', 'Communication', 'linkedin.com', '#0A66C2', 'faLinkedinIn', 'professional networking social'],
  ['discord', 'Discord', 'Communication', 'discord.com', '#5865F2', 'faDiscord', 'chat communities'],
  ['youtube', 'YouTube', 'Everyday', 'youtube.com', '#CF2828', 'faYoutube', 'video tutorials'],
  ['spotify', 'Spotify', 'Everyday', 'open.spotify.com', '#168743', 'faSpotify', 'music podcasts'],
  ['reddit', 'Reddit', 'Everyday', 'reddit.com', '#C84817', 'faRedditAlien', 'community forums']
];
const specialIcons = {
  jira: ['https://jira.atlassian.com/favicon.ico'],
  github: ['https://github.githubassets.com/favicons/favicon.png'],
  netlify: ['https://www.netlify.com/favicon/favicon-32x32.png', 'https://www.netlify.com/favicon.ico'],
  figma: ['https://static.figma.com/app/icon/1/favicon.svg'],
  gmail: ['https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'],
  'google-drive': ['https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png'],
  'google-calendar': ['https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico']
};
export const APPS = definitions.map(([id, name, category, domain, colour, fallback, aliases]) => ({
  id, name, category, domain, colour, fallback, aliases,
  iconSources: specialIcons[id] || [`https://${domain.split('/')[0]}/apple-touch-icon.png`, `https://${domain.split('/')[0]}/favicon.ico`]
}));
export const APP_MAP = new Map(APPS.map(app => [app.id, app]));
export const CATEGORIES = ['All apps', 'Product & design', 'Development', 'Productivity', 'Communication', 'AI', 'Business', 'Everyday'];
export const EXAMPLE_IDS = ['jira', 'figma', 'github', 'netlify'];
