import fs from 'fs';
import { Feed } from 'feed';
import dayjs from 'dayjs';
import { defaultOptions } from './internals';

const undefIfFalse = (condition, value) =>
  condition !== false ? value : undefined;

function addItemToFeed(feed, siteMetadata, options) {
	return function (page) {
		const item = {
			title: page.frontmatter.title,
			id: `${siteMetadata.siteUrl}${page.frontmatter.url}`,
			link: `${siteMetadata.siteUrl}${page.frontmatter.url}`,
			date: dayjs(page.frontmatter.date).toDate(),
			content: page.excerpt,
			author: [{
				name: options.author || siteMetadata.author.name,
				email: undefIfFalse(options.email, options.email),
				link: options.link || siteMetadata.siteUrl
			}]
		};
		feed.addItem(item);
	};
}

function buildFeed(pages, siteMetadata, options, output) {
  const feed = new Feed({
    title: options.title || siteMetadata.title,
    description: options.description || siteMetadata.description,
    link: options.link || siteMetadata.siteUrl,
    id: options.id || siteMetadata.siteUrl,
    copyright:
      options.copyright ||
      `All rights reserved ${new Date().getUTCFullYear()}, ${
        options.author || siteMetadata.author.name
      }`,
    feedLinks: {
      atom: `${siteMetadata.siteUrl}/${output.atom}`,
      rss2: `${siteMetadata.siteUrl}/${output.rss2}`,
      json: `${siteMetadata.siteUrl}/${output.json}`,
    },
    author: {
      name: options.author || siteMetadata.author.name,
      email: undefIfFalse(options.email, options.email),
      link: siteMetadata.siteUrl,
    },
  });

  pages
    .map(page => page.node)
    .forEach(addItemToFeed(feed, siteMetadata, options));

  feed.addContributor({
    name: siteMetadata.author.name,
    email: options.email,
    link: siteMetadata.siteUrl,
  });

  return feed;
}

function generateAtomFeed(feed, name) {
  return fs.writeFileSync(`./public/${name}`, feed.atom1());
}

function generateRSSFeed(feed, name) {
  return fs.writeFileSync(`./public/${name}`, feed.rss2());
}

function generateJSONFeed(feed, name) {
  return fs.writeFileSync(`./public/${name}`, feed.json1());
}

async function generateFeed({ graphql }, feedOptions) {
  const output = { ...defaultOptions.output, ...feedOptions.output };
  const options = { ...defaultOptions, ...feedOptions };

  const result = await graphql(`
{
  site {
    siteMetadata {
      title
      description
      author {
        name
      }
      siteUrl
    }
  }
  allMarkdownRemark(filter: {fileAbsolutePath: {regex: "${options.match}" }}, sort: {fields: [frontmatter___date], order: DESC}, limit: ${options.limit}) {
    edges {
      node {
        id
        excerpt(pruneLength: 280)
        frontmatter {
          date(formatString: "DD MMMM YYYY")
          url
          title
        }
      }
    }
  }
}
  `);

  if (result.errors) {
    throw result.errors;
  }

  const posts = result.data.allMarkdownRemark.edges;
  const siteMetadata = result.data.site.siteMetadata;
  const feed = buildFeed(posts, siteMetadata, options, output);
  generateAtomFeed(feed, output.atom);
  generateRSSFeed(feed, output.rss2);
  generateJSONFeed(feed, output.json);
}

exports.onPostBuild = async ({ graphql }, pluginOptions) => {
  if (pluginOptions.feeds && !Array.isArray(pluginOptions.feeds)) {
    throw new Error('@fec/gatsby-plugin-feed `feeds` option must be an array.');
  } else if (!pluginOptions.feeds) {
    await generateFeed({ graphql }, {});
    return;
  }
  for (let i = 0; i < pluginOptions.feeds.length; i += 1) {
    await generateFeed({ graphql }, pluginOptions.feeds[i]);
  }
};
