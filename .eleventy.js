// eleventy-img v7 is ESM-only: require() gives the module namespace, so the
// image function itself is the default export.
const Image = require("@11ty/eleventy-img").default;
const fs = require("node:fs");
const path = require("node:path");

const SITE_URL = "https://jonathanmccallum.com";
const CONTENT_DIR = path.join(__dirname, "content");
const OUTPUT_DIR = path.join(__dirname, "_site");

// ---------------------------------------------------------------------------
// YouTube: extract a video id from watch / embed / shorts / youtu.be URLs.
// ---------------------------------------------------------------------------
function youtubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:embed\/|shorts\/|watch\?[^#]*v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : null;
}

module.exports = function (eleventyConfig) {
  // RFC3339 dates for the feed (toISOString is already RFC3339).
  eleventyConfig.addFilter("dateToRfc3339", (date) =>
    new Date(date).toISOString()
  );

  // Newest date in a collection (the RSS plugin's filter, defined locally
  // so the feed works without that dependency). Empty collection -> now,
  // so the feed stays valid before any post is published.
  eleventyConfig.addFilter("getNewestCollectionItemDate", (collection) => {
    if (!collection || collection.length === 0) return new Date();
    return new Date(
      Math.max(...collection.map((item) => new Date(item.date)))
    );
  });

  // Human-readable dates, e.g. "12 March 2014".
  eleventyConfig.addFilter("readableDate", (date) =>
    new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );

  // Plain-text excerpt from rendered HTML: the first ~150 characters of
  // real text, never invented. The page heading and the post date line are
  // dropped first, so the excerpt starts with the writing itself. Used
  // for meta descriptions and JSON-LD.
  eleventyConfig.addFilter("excerpt", (html, length = 150) => {
    const text = String(html || "")
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<h1[^>]*>.*?<\/h1>/g, " ")
      .replace(/<p class="meta">.*?<\/p>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length <= length) return text;
    return text.slice(0, length).replace(/\s+\S*$/, "") + "…";
  });

  // Static assets: one CSS file, three small same-origin scripts, the
  // recovered images, and the GitHub Pages CNAME.
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  // No passthrough for content/images: the 47 recovered originals
  // (~121 MB) are not referenced by any published page. The image
  // transform writes WebP/AVIF derivatives into _site/images itself,
  // and the share image is written there by the postbuild script.
  // Copying the originals would only bloat the deploy.
  eleventyConfig.addPassthroughCopy("CNAME");
  // Cloudflare Pages reads these from the build output root.
  eleventyConfig.addPassthroughCopy("_headers");
  eleventyConfig.addPassthroughCopy("_redirects");

  // The recovered homepage.md only lists recent posts (all held as drafts, so
  // its links would be dead). The real homepage is index.njk at the root.
  eleventyConfig.ignores.add("content/homepage.md");
  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("MAINTENANCE.md");
  eleventyConfig.ignores.add("RECOVERY-REPORT.md");
  // Internal docs must never publish as pages (they were live at
  // /PUBLISHING/ and /VOICE/ until 22 Nov 2026).
  eleventyConfig.ignores.add("PUBLISHING.md");
  eleventyConfig.ignores.add("VOICE.md");
  eleventyConfig.ignores.add("AGENTS.md");
  // Transcript extracts and draft short posts live in the repo as the
  // source of truth, but they are never published as pages.
  eleventyConfig.ignores.add("transcripts/**");
  eleventyConfig.ignores.add("drafts/**");
  // The fetcher's scratch files (raw HTML snapshots, logs, scripts).
  eleventyConfig.ignores.add("work/**");
  // The site-AI Worker lives in its own folder and is never part of the
  // static site build.
  eleventyConfig.ignores.add("site-ai/**");
  eleventyConfig.ignores.add("scripts/**");

  // Collections.
  eleventyConfig.addCollection("pages", (api) =>
    api.getFilteredByGlob("content/pages/*.md")
  );
  eleventyConfig.addCollection("allPosts", (api) =>
    api.getFilteredByGlob("content/posts/*.md")
  );
  eleventyConfig.addCollection("publishedPosts", (api) =>
    api
      .getFilteredByGlob("content/posts/*.md")
      .filter((post) => !post.data.draft)
  );

  // ---------------------------------------------------------------------------
  // Transform 1: YouTube links and iframes become tap-to-load facades.
  // No third-party script or iframe loads until the reader taps play; the
  // iframe then comes from youtube-nocookie.com. A tiny inline click handler
  // in the base layout does the swap (the site's only JavaScript).
  // ---------------------------------------------------------------------------
  eleventyConfig.addTransform("videoFacade", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) {
      return content;
    }
    const facade = (id) =>
      `<div class="video-facade"><button type="button" class="video-facade__button" data-video-id="${id}" aria-label="Play video on YouTube"><img class="video-facade__thumb" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span class="video-facade__play" aria-hidden="true">&#9654;</span></button></div>`;

    // <a href="...youtube...">...</a> links
    content = content.replace(
      /<a\b[^>]*href="([^"]*(?:youtube\.com|youtu\.be)[^"]*)"[^>]*>.*?<\/a>/gs,
      (match, href) => {
        const id = youtubeId(href);
        return id ? facade(id) : match;
      }
    );
    // Raw <iframe> embeds pointing at YouTube (none in the archive today,
    // but future posts may contain them).
    content = content.replace(
      /<iframe\b[^>]*src="([^"]*(?:youtube\.com|youtu\.be)[^"]*)"[^>]*>(?:<\/iframe>)?/g,
      (match, src) => {
        const id = youtubeId(src);
        return id ? facade(id) : match;
      }
    );
    return content;
  });

  // ---------------------------------------------------------------------------
  // Transform 2: local images become WebP with srcset, width/height set
  // (no layout shift) and loading="lazy". Images not yet recovered by the
  // Wayback fetch are left as plain <img> tags so the build never fails;
  // they are converted automatically on the next build once they arrive.
  // ---------------------------------------------------------------------------
  eleventyConfig.addTransform("responsiveImages", async function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) {
      return content;
    }
    const imgTags = [...content.matchAll(/<img\b[^>]*>/g)];
    if (imgTags.length === 0) return content;

    for (const [tag] of imgTags) {
      const srcMatch = tag.match(/src="(\/images\/[^"]+)"/);
      if (!srcMatch) continue;
      const src = srcMatch[1];
      const localPath = path.join(CONTENT_DIR, src.replace(/^\/+/, ""));
      if (!fs.existsSync(localPath)) {
        console.log(`[images] not yet recovered, leaving as-is: ${src}`);
        continue;
      }
      // Animated GIFs are left as-is: converting them to AVIF/WebP stills
      // would kill the animation. Copy the original through instead.
      if (/\.gif$/i.test(src)) {
        const dest = path.join(OUTPUT_DIR, "images", path.basename(src));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(localPath, dest);
        continue;
      }
      const altMatch = tag.match(/alt="([^"]*)"/);
      const alt = altMatch ? altMatch[1] : "";
      const classMatch = tag.match(/class="([^"]*)"/);
      const cls = classMatch ? classMatch[1] : "";
      try {
        // Original-size pass first, so we know the intrinsic width and never upscale.
        const original = await Image(localPath, {
          widths: [null],
          formats: ["avif", "webp"],
          outputDir: path.join(OUTPUT_DIR, "images"),
          urlPath: "/images/",
          filenameFormat: (id, srcPath, width, format) => {
            const name = path.parse(srcPath).name;
            return `${name}-${width}w.${format}`;
          },
        });
        const intrinsicWidth = original.webp[0].width;
        const widths = [...new Set([320, 640, 960].filter((w) => w < intrinsicWidth))];
        const metadata = await Image(localPath, {
          widths: widths.length ? [...widths, null] : [null],
          formats: ["avif", "webp"],
          outputDir: path.join(OUTPUT_DIR, "images"),
          urlPath: "/images/",
          filenameFormat: (id, srcPath, width, format) => {
            const name = path.parse(srcPath).name;
            return `${name}-${width}w.${format}`;
          },
        });
        const replacement = Image.generateHTML(metadata, {
          alt,
          sizes: "(max-width: 640px) 100vw, 640px",
          loading: "lazy",
          decoding: "async",
          ...(cls ? { class: cls } : {}),
        });
        content = content.replace(tag, replacement);
      } catch (err) {
        console.log(`[images] could not convert ${src}: ${err.message}`);
      }
    }
    return content;
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
};
