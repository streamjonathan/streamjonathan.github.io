// Promptfoo custom provider: calls the live /api/ask endpoint and
// returns its answer text. Promptfoo passes the rendered prompt
// (the test question) as the first argument.
// Run after each Worker change, once the day's AI allowance has
// reset (the free tier is 10,000 Neurons/day):
//   npx promptfoo@latest eval -c site-ai/promptfoo.yaml
export default async function (prompt) {
  const res = await fetch("https://jonathanmccallum.com/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: prompt }),
  });
  const data = await res.json();
  return { output: data.answer || "" };
}
