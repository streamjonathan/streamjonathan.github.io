// Directory data for the recovered pages.
//
// Pages publish at their original WordPress URL (from original_url). The
// :80 port in some old URLs is dropped by the URL parser, so
// http://www.jonathanmccallum.com:80/articlesbyjonathan/ becomes
// /articlesbyjonathan/ as it should.
module.exports = {
  layout: "layouts/page.njk",
  tags: ["pages"],
  eleventyComputed: {
    permalink: (data) => {
      try {
        return new URL(data.original_url).pathname;
      } catch {
        return `/${data.slug}/`;
      }
    },
  },
};
