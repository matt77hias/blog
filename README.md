<img align="left" src="https://matt77hias.github.io/assets/Avatar.png" width="120px"/>

[![License][s1]][li]

[s1]: https://img.shields.io/badge/licence-No%20Licence-blue.svg
[li]: https://raw.githubusercontent.com/matt77hias/matt77hias.github.io/master/LICENSE.txt

# [blog](https://matt77hias.github.io/blog.html)

Personal blog of [Matthias Moulin](https://matt77hias.github.io) — computer graphics, C++, and rendering.

## Stack

Jekyll static site served at `/blog` under the main site's domain. No external theme — design, CSS, and JS are custom and shared with the main site.

- **Build** — Jekyll with Rouge syntax highlighting and kramdown Markdown
- **Design** — inherits the glassmorphism dark/light design system from [matt77hias.github.io](https://matt77hias.github.io); tokens, layout chrome (header, nav, footer, profile bar) loaded directly from the main site
- **Math** — MathJax 2.7 (opt-in per post via `math: true` front matter)
- **Comments** — [Giscus](https://giscus.app) (GitHub Discussions)
- **Analytics** — GA4 shared with the main site

## Structure

```
_layouts/
  default.html     Base HTML shell (head, body, chrome via layout.js)
  post.html        Post wrapper (title card, date, content, Giscus)
_includes/
  yt-video.html    Responsive YouTube embed helper
_posts/            Markdown posts (YYYY-MM-DD-slug.md)
css/
  blog.css         Blog-specific styles (prose, code blocks, ToC, etc.)
  syntax.css       Rouge/Solarized Dark syntax theme
  video.css        16:9 responsive iframe wrapper
js/
  layout.js        Site chrome builder (reads main_site from meta tag)
res/
  Images/          Post images
```

## Dependencies

| Library | License |
|---------|---------|
| [Jekyll](https://jekyllrb.com) | [MIT](https://github.com/jekyll/jekyll/blob/master/LICENSE) |
| [MathJax 2.7](https://www.mathjax.org) | [Apache 2.0](https://github.com/mathjax/MathJax/blob/master/LICENSE) |
| [Giscus](https://giscus.app) | [MIT](https://github.com/giscus/giscus/blob/main/LICENSE) |
| [Rouge](http://rouge.jneen.net) | [MIT](https://github.com/rouge-ruby/rouge/blob/master/LICENSE) |

Assets shared with the main site (tokens, fonts, icons, JS chrome) are governed by the main site's respective licenses.

## Development

No Gemfile is included; the site deploys via `actions/jekyll-build-pages` on GitHub Pages. To serve locally, install Jekyll and run:

```bash
bundle exec jekyll serve --baseurl ""
```

Add `math: true` to a post's front matter to enable MathJax for that post.

<p align="center">Copyright © 2015-2026 Matthias Moulin. All Rights Reserved.</p>
