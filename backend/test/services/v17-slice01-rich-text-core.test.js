import { describe, expect, it } from "vitest";

import { normalizeRichText } from "../../src/services/rich-text.service.js";

describe("V17 Slice 01 rich text core", () => {
  it("keeps the Full formatting shared with Frontend V04 and derives matching text", () => {
    const result = normalizeRichText('<h2 style="text-align: center">Hello <strong>world</strong></h2><p><span style="font-family: Georgia; font-size: 18px; color: #aabbcc">A&nbsp;B</span> <mark>now</mark></p>');
    expect(result).toEqual({
      html: '<h2 style="text-align:center">Hello <strong>world</strong></h2><p><span style="font-family:Georgia;font-size:18px;color:#aabbcc">A B</span> <mark>now</mark></p>',
      text: "Hello world\n\nA B now",
    });
  });

  it("strips unsupported Minimal formatting while keeping meaningful content", () => {
    const result = normalizeRichText('<h1>Profile <strong>lead</strong></h1><p style="text-align: right"><span style="color: red">One</span> <em>two</em> <s>three</s></p>', "minimal");
    expect(result).toEqual({
      html: '<p>Profile <strong>lead</strong></p><p>One <em>two</em> three</p>',
      text: "Profile lead\n\nOne two three",
    });
  });

  it("preserves paragraph, line break, and list meaning in plain text", () => {
    const result = normalizeRichText('<p>First  line<br>next</p><ul><li>Alpha</li><li>Beta</li></ul><ol start="3" type="A"><li>Third</li><li>Fourth</li></ol>');
    expect(result.text).toBe("First line\nnext\n\nAlpha\nBeta\n\nThird\nFourth");
    expect(result.html).toContain('<ol start="3" type="A">');
  });

  it("drops executable content and unsafe attributes without rejecting safe text", () => {
    const result = normalizeRichText('<p onclick="go()">Stay<script>alert(1)</script><img src=x onerror="go()"> safe</p><svg><a href="https://evil.test">Hidden</a></svg><a href="javascript:alert(1)" target="_blank">Link</a>');
    expect(result).toEqual({ html: '<p>Stay safe</p><a>Link</a>', text: "Stay safe\n\nLink" });
  });

  it("keeps readable text inside unsupported harmless containers", () => {
    expect(normalizeRichText('<form><button>Apply</button></form><p>Today</p>')).toEqual({
      html: "Apply<p>Today</p>", text: "Apply\n\nToday",
    });
  });

  it("accepts only safe Frontend V04 URL shapes and controls new tabs", () => {
    const result = normalizeRichText('<a href="https://example.com?q=1&amp;x=2" target="_blank" rel="opener">Web</a><a href="/jobs/1"> job</a><a href="mailto:a@example.com"> mail</a><a href="&#x6a;avascript:alert(1)"> bad</a><a href="//evil.test"> protocol-relative</a>');
    expect(result.html).toBe('<a href="https://example.com?q=1&amp;x=2" target="_blank" rel="noopener noreferrer">Web</a><a href="/jobs/1"> job</a><a href="mailto:a@example.com"> mail</a><a> bad</a><a> protocol-relative</a>');
    expect(result.text).toBe("Web job mail bad protocol-relative");
  });

  it.each(["", "<p><br></p>", "<p> &nbsp; </p>", "<script>ignored</script>"])(
    "treats markup without real text as empty: %s", (html) => {
      expect(normalizeRichText(html)).toEqual({ html: "", text: "" });
    },
  );

  it("escapes literal markup and decodes entities into the same plain text", () => {
    expect(normalizeRichText("<p>A &lt; B &amp; C &#169;</p>")).toEqual({
      html: "<p>A &lt; B &amp; C ©</p>", text: "A < B & C ©",
    });
    expect(normalizeRichText("1 < 2 and <strong>3</strong>")).toEqual({
      html: "1 &lt; 2 and <strong>3</strong>", text: "1 < 2 and 3",
    });
    expect(normalizeRichText("A < B > C")).toEqual({
      html: "A &lt; B &gt; C", text: "A < B > C",
    });
  });

  it.each(["<ul></ul>", "<ol><li></li></ol>", "<ul><li><br></li></ul>"])(
    "does not invent content for an empty list: %s", (html) => {
      expect(normalizeRichText(html)).toEqual({ html: "", text: "" });
    },
  );

  it("decodes named and numeric entities once in both representations", () => {
    expect(normalizeRichText("<p>Caf&eacute; &euro; &#x1F600; &amp; &amp;copy;</p>")).toEqual({
      html: "<p>Café € 😀 &amp; &amp;copy;</p>",
      text: "Café € 😀 & &copy;",
    });
  });

  it.each(["full", "minimal"])("preserves block boundaries in %s when normalizing unsupported containers", (preset) => {
    expect(normalizeRichText("<div>First</div><div>Second</div>", preset).text).toBe("First\n\nSecond");
    expect(normalizeRichText("<h1>Heading</h1><p>Body</p>", preset).text).toBe("Heading\n\nBody");
    expect(normalizeRichText("<div><p>Nested</p></div><div>Later</div>", preset).text).toBe("Nested\n\nLater");
  });
});
