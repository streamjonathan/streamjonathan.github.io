// Directory data for the recovered posts.
//
// Every post is held back as a draft until Jonathan reviews it: draft posts
// get no permalink, so Eleventy writes no page for them at all. To publish
// one post, add `draft: false` to that post's front matter.
//  - Posts from jonathanmccallum.com keep their original WordPress address
//    (from original_url), so old links keep working.
//  - Posts from elsewhere (e.g. Substack) get a plain date-based address
//    on this site, so nothing keeps a Substack "/p/" address.
// To publish all posts at once, change `draft: true` below to false.
module.exports = {
  layout: "layouts/post.njk",
  draft: true,
  tags: ["posts"],
  eleventyComputed: {
    permalink: (data) => {
      if (data.draft) return false;
      const datePath = () => {
        const d = new Date(data.date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `/${y}/${m}/${day}/${data.slug}/`;
      };
      try {
        const u = new URL(data.original_url);
        if (
          u.hostname === "jonathanmccallum.com" ||
          u.hostname === "www.jonathanmccallum.com"
        ) {
          let p = u.pathname;
          if (!p.endsWith("/")) p += "/";
          return p;
        }
        return datePath();
      } catch {
        return datePath();
      }
    },
  },
};
