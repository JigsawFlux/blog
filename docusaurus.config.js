// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'JigsawFlux Blog',
  tagline: 'Building Tools That Make a Real Difference',
  favicon: 'img/favicon.ico',

  url: 'https://jigsawflux.org',
  baseUrl: '/blog/',

  organizationName: 'JigsawFlux',
  projectName: 'blog',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: false,
        blog: {
          routeBasePath: '/',
          showReadingTime: true,
          blogTitle: 'JigsawFlux Blog',
          blogDescription: 'Updates and insights from the JigsawFlux open-source community — health tech, crisis management, and humanitarian tools.',
          postsPerPage: 10,
          feedOptions: {
            type: ['rss', 'atom'],
            title: 'JigsawFlux Blog',
            description: 'Updates from the JigsawFlux open-source community',
            copyright: `Copyright © ${new Date().getFullYear()} JigsawFlux`,
          },
          editUrl: 'https://github.com/JigsawFlux/blog/tree/main/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'JigsawFlux Blog',
        logo: {
          alt: 'JigsawFlux Logo',
          src: 'img/logo.svg',
          href: 'https://jigsawflux.org',
          target: '_self',
        },
        items: [
          { to: '/', label: 'Blog', position: 'left' },
          {
            href: 'https://jigsawflux.org',
            label: 'Main Site',
            position: 'right',
          },
          {
            href: 'https://github.com/JigsawFlux',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            label: 'JigsawFlux.org',
            href: 'https://jigsawflux.org',
          },
          {
            label: 'Projects',
            href: 'https://jigsawflux.org/projects',
          },
          {
            label: 'GitHub',
            href: 'https://github.com/JigsawFlux',
          },
          {
            label: 'RSS Feed',
            href: '/blog/rss.xml',
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} JigsawFlux. Built with Docusaurus.`,
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
};

export default config;
